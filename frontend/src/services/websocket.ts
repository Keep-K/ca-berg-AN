/**
 * WebSocket Manager
 * Singleton pattern for managing a single WebSocket connection
 */

type MessageHandler = (data: any) => void;
type ConnectionHandler = () => void;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private isConnecting = false;

  constructor(url: string = 'ws://localhost:3000') {
    this.url = url;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WebSocketManager] Already connected');
      return;
    }

    if (this.isConnecting) {
      console.log('[WebSocketManager] Connection already in progress');
      return;
    }

    this.isConnecting = true;
    console.log(`[WebSocketManager] Connecting to ${this.url}...`);

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[WebSocketManager] Connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.connectionHandlers.forEach((handler) => handler());
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.messageHandlers.forEach((handler) => handler(data));
        } catch (error) {
          console.error('[WebSocketManager] Failed to parse message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocketManager] Error:', error);
        this.isConnecting = false;
      };

      this.ws.onclose = (event) => {
        console.log(`[WebSocketManager] Connection closed (code: ${event.code})`);
        this.isConnecting = false;
        this.ws = null;

        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
          console.log(`[WebSocketManager] Will reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
          
          this.reconnectTimer = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
          }, delay);
        }
      };
    } catch (error) {
      console.error('[WebSocketManager] Failed to create WebSocket:', error);
      this.isConnecting = false;
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
  }

  send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[WebSocketManager] Cannot send message: WebSocket not connected');
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  onConnection(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Export singleton instance
export const webSocketManager = new WebSocketManager();
