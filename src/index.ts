/**
 * Main Server Entry Point
 * Express REST API + WebSocket Server (JWT auth, per-user data)
 */

import express from 'express';
import { createServer } from 'http';
import WebSocket from 'ws';
import { config } from './config';
import { createRoutes } from './api/routes';
import { createAuthRoutes } from './api/authRoutes';
import { EventBus } from './realtime/eventBus';
import { UserContextService } from './auth/userContextService';
import * as authService from './auth/authService';

// Initialize services
const app = express();
const server = createServer(app);
const wss = new WebSocket.Server({ server });

const eventBus = new EventBus();
const userContextService = new UserContextService(eventBus);

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

// Auth routes (no JWT)
app.use('/api/auth', createAuthRoutes());

// API routes (JWT required; per-user PM/EE)
app.use('/api', createRoutes(eventBus, userContextService));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

// WebSocket: store clients with userId (set after JWT auth)
interface ClientWithUser extends WebSocket {
  userId?: number;
}
const clients = new Set<ClientWithUser>();

wss.on('connection', (ws: ClientWithUser) => {
  console.log('[WebSocket] New client connected (awaiting auth)');
  clients.add(ws);

  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'auth' && data.token) {
        try {
          const { userId } = authService.verifyToken(data.token);
          ws.userId = userId;
          ws.send(JSON.stringify({ type: 'authenticated', userId }));
          // Send initial snapshot for this user
          userContextService.getPortfolioManager(userId).then((pm) => {
            const snapshot = pm.getLatestSnapshot();
            if (snapshot) {
              ws.send(JSON.stringify({ type: 'snapshot', data: snapshot }));
            }
          }).catch(() => {});
          return;
        } catch {
          ws.send(JSON.stringify({ type: 'error', error: 'Invalid or expired token' }));
          return;
        }
      }
      // Other message types
    } catch (error) {
      console.error('[WebSocket] Invalid message:', error);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('[WebSocket] Error:', error);
    clients.delete(ws);
  });
});

// Event bus: broadcast updates only to the user who owns the data
eventBus.initialize().then(async () => {
  eventBus.subscribeToUpdates((update, userId) => {
    const payload = JSON.stringify({ type: 'update', data: update });
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && (userId === undefined || client.userId === userId)) {
        client.send(payload);
      }
    });
  });

  eventBus.subscribeToAlerts((alert) => {
    const payload = JSON.stringify({ type: 'alert', data: alert });
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  });
});

// Start server and ensure dev account
const PORT = config.server.port;

server.listen(PORT, async () => {
  console.log(`[Server] Listening on port ${PORT}`);
  console.log(`[Server] REST API: http://localhost:${PORT}/api`);
  console.log(`[Server] WebSocket: ws://localhost:${PORT} (send { type: 'auth', token: '<JWT>' } after connect)`);

  try {
    const dev = await authService.ensureDevAccount();
    if (dev) {
      console.log('[DEV ACCOUNT CREATED]');
      console.log(`Email: ${dev.email}`);
      console.log(`Password: ${dev.password}`);
    }
  } catch (e) {
    console.warn('[Server] Could not ensure dev account (DB may not be ready):', (e as Error).message);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] Shutting down...');
  server.close(() => {
    console.log('[Server] Closed');
    process.exit(0);
  });
});
