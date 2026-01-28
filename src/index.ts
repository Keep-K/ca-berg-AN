/**
 * Main Server Entry Point
 * Express REST API + WebSocket Server
 */

import express from 'express';
import { createServer } from 'http';
import WebSocket from 'ws';
import { config } from './config';
import { createRoutes } from './api/routes';
import { PortfolioManager } from './portfolio/manager';
import { RealtimeMonitor } from './realtime/monitor';
import { EventBus } from './realtime/eventBus';
import { ExecutionEngine } from './execution/executor';

// Initialize services
const app = express();
const server = createServer(app);
const wss = new WebSocket.Server({ server });

const portfolioManager = new PortfolioManager();
const realtimeMonitor = new RealtimeMonitor();
const eventBus = new EventBus();
const executionEngine = new ExecutionEngine(portfolioManager, eventBus);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Multi-Exchange Portfolio Monitor',
    version: '1.0.0',
    status: 'running',
  });
});

// API Routes
app.use('/api', createRoutes(portfolioManager, realtimeMonitor, eventBus, executionEngine));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

// WebSocket connection handling
const clients = new Set<WebSocket>();

wss.on('connection', (ws: WebSocket, req) => {
  console.log(`[WebSocket] New client connected`);
  clients.add(ws);

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'WebSocket connection established',
  }));

  // Send initial snapshot if available
  const snapshot = portfolioManager.getLatestSnapshot();
  if (snapshot) {
    ws.send(JSON.stringify({
      type: 'snapshot',
      data: snapshot,
    }));
  }

  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message.toString());
      // Handle client messages
    } catch (error) {
      console.error('[WebSocket] Invalid message:', error);
    }
  });

  ws.on('close', () => {
    console.log('[WebSocket] Client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('[WebSocket] Error:', error);
    clients.delete(ws);
  });
});

// Broadcast function
function broadcastToClients(message: any): void {
  const data = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// Setup event bus subscriptions
eventBus.initialize().then(() => {
  eventBus.subscribeToUpdates((update) => {
    broadcastToClients({ type: 'update', data: update });
  });

  eventBus.subscribeToAlerts((alert) => {
    broadcastToClients({ type: 'alert', data: alert });
  });
});

// Setup realtime monitor alerts
realtimeMonitor.onAlert((alert) => {
  console.log(`[Alert] ${alert.severity.toUpperCase()}: ${alert.message}`);
  eventBus.publishAlert(alert);
});

// Periodic portfolio snapshot updates
const SNAPSHOT_INTERVAL = 30000; // 30 seconds

async function updatePortfolioSnapshot(): Promise<void> {
  try {
    // Only fetch if there are registered connectors
    const registeredExchanges = portfolioManager.getRegisteredExchanges();
    if (registeredExchanges.length === 0) {
      console.log('[Portfolio] No exchanges registered, skipping snapshot update');
      return;
    }

    console.log(`[Portfolio] Updating snapshot for ${registeredExchanges.length} exchange(s)...`);
    const snapshot = await portfolioManager.fetchPortfolioSnapshot();
    console.log(`[Portfolio] Snapshot updated: ${snapshot.balances.length} balances, ${snapshot.positions.length} positions`);
    
    realtimeMonitor.processSnapshot(snapshot);
    broadcastToClients({ type: 'snapshot', data: snapshot });
  } catch (error) {
    console.error('[Portfolio] Error updating snapshot:', error);
  }
}

// Start periodic updates
setInterval(updatePortfolioSnapshot, SNAPSHOT_INTERVAL);
updatePortfolioSnapshot();

// Start server
const PORT = config.server.port;

server.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
  console.log(`[Server] REST API: http://localhost:${PORT}/api`);
  console.log(`[Server] WebSocket: ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] Shutting down...');
  server.close(() => {
    console.log('[Server] Closed');
    process.exit(0);
  });
});
