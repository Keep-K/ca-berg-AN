/**
 * Event Bus for Real-Time Updates
 * Uses Redis pub/sub for distributed event broadcasting
 */

import { createClient, RedisClientType } from 'redis';
import { RealtimeUpdate, AlertEvent } from '../types';
import { config } from '../config';

export class EventBus {
  private publisher: RedisClientType | null = null;
  private subscriber: RedisClientType | null = null;
  private isConnected: boolean = false;

  /**
   * Initialize Redis connections
   */
  async initialize(): Promise<void> {
    try {
      this.publisher = createClient({
        socket: {
          host: config.redis.host,
          port: config.redis.port,
        },
      });

      this.subscriber = createClient({
        socket: {
          host: config.redis.host,
          port: config.redis.port,
        },
      });

      await this.publisher.connect();
      await this.subscriber.connect();

      this.isConnected = true;
      console.log('[EventBus] Redis connected');
    } catch (error) {
      console.error('[EventBus] Failed to connect to Redis:', error);
      this.isConnected = false;
    }
  }

  /**
   * Publish real-time update
   */
  async publishUpdate(update: RealtimeUpdate): Promise<void> {
    if (!this.isConnected || !this.publisher) {
      console.warn('[EventBus] Not connected, update not published');
      return;
    }

    try {
      await this.publisher.publish(
        'portfolio:updates',
        JSON.stringify(update)
      );
    } catch (error) {
      console.error('[EventBus] Failed to publish update:', error);
    }
  }

  /**
   * Publish alert
   */
  async publishAlert(alert: AlertEvent): Promise<void> {
    if (!this.isConnected || !this.publisher) {
      console.warn('[EventBus] Not connected, alert not published');
      return;
    }

    try {
      await this.publisher.publish('portfolio:alerts', JSON.stringify(alert));
    } catch (error) {
      console.error('[EventBus] Failed to publish alert:', error);
    }
  }

  /**
   * Subscribe to updates
   */
  async subscribeToUpdates(callback: (update: RealtimeUpdate) => void): Promise<void> {
    if (!this.isConnected || !this.subscriber) {
      console.warn('[EventBus] Not connected, cannot subscribe');
      return;
    }

    try {
      await this.subscriber.subscribe('portfolio:updates', (message) => {
        try {
          const update = JSON.parse(message) as RealtimeUpdate;
          callback(update);
        } catch (error) {
          console.error('[EventBus] Failed to parse update message:', error);
        }
      });
    } catch (error) {
      console.error('[EventBus] Failed to subscribe to updates:', error);
    }
  }

  /**
   * Subscribe to alerts
   */
  async subscribeToAlerts(callback: (alert: AlertEvent) => void): Promise<void> {
    if (!this.isConnected || !this.subscriber) {
      console.warn('[EventBus] Not connected, cannot subscribe');
      return;
    }

    try {
      await this.subscriber.subscribe('portfolio:alerts', (message) => {
        try {
          const alert = JSON.parse(message) as AlertEvent;
          callback(alert);
        } catch (error) {
          console.error('[EventBus] Failed to parse alert message:', error);
        }
      });
    } catch (error) {
      console.error('[EventBus] Failed to subscribe to alerts:', error);
    }
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    if (this.publisher) {
      await this.publisher.quit();
    }
    if (this.subscriber) {
      await this.subscriber.quit();
    }
    this.isConnected = false;
  }
}
