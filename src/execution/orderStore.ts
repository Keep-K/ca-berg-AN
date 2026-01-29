/**
 * Order Store
 * Database operations for orders and trades
 */

import { Pool } from 'pg';
import { config } from '../config';
import { OrderResult, TradeFill } from '../types';

// Initialize PostgreSQL connection pool
const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.database,
  user: config.database.user,
  password: String(config.database.password || 'postgres'), // Ensure password is always a string
});

export class OrderStore {
  /**
   * Store a new order (with user_id for multi-tenant)
   */
  async storeOrder(order: OrderResult, userId: number): Promise<void> {
    try {
      const query = `
        INSERT INTO orders (
          user_id, order_id, exchange, symbol, side, type, price, quantity,
          status, filled_quantity, remaining_quantity, created_at, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12)
        ON CONFLICT (order_id, exchange) DO UPDATE SET
          status = EXCLUDED.status,
          filled_quantity = EXCLUDED.filled_quantity,
          remaining_quantity = EXCLUDED.remaining_quantity
      `;

      await pool.query(query, [
        userId,
        order.orderId,
        order.exchange,
        order.symbol,
        order.side,
        order.type,
        order.price,
        order.quantity,
        order.status,
        order.filledQuantity,
        order.remainingQuantity,
        order.timestamp,
      ]);
    } catch (error: any) {
      // Re-throw connection errors so caller can handle gracefully
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw error;
      }
      // For other errors, log and re-throw
      console.error('[OrderStore] Error storing order:', error);
      throw error;
    }
  }

  /**
   * Update order status
   */
  async updateOrder(
    orderId: string,
    exchange: string,
    updates: Partial<OrderResult>
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.filledQuantity !== undefined) {
      fields.push(`filled_quantity = $${paramIndex++}`);
      values.push(updates.filledQuantity);
    }
    if (updates.remainingQuantity !== undefined) {
      fields.push(`remaining_quantity = $${paramIndex++}`);
      values.push(updates.remainingQuantity);
    }

    if (fields.length === 0) return;

    values.push(orderId, exchange);
    const query = `
      UPDATE orders
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE order_id = $${paramIndex++} AND exchange = $${paramIndex++}
    `;

    await pool.query(query, values);
  }

  /**
   * Store a trade fill (with user_id for multi-tenant)
   */
  async storeTrade(trade: TradeFill, userId: number): Promise<void> {
    const query = `
      INSERT INTO trades (
        user_id, trade_id, order_id, exchange, symbol, side, price, quantity,
        fee, fee_asset, timestamp, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (trade_id, exchange) DO NOTHING
    `;

    await pool.query(query, [
      userId,
      trade.tradeId,
      trade.orderId,
      trade.exchange,
      trade.symbol,
      trade.side,
      trade.price,
      trade.quantity,
      trade.fee,
      trade.feeAsset,
      trade.timestamp,
    ]);
  }

  /**
   * Get order history (filtered by user_id)
   */
  async getOrderHistory(
    userId: number,
    exchange?: string,
    symbol?: string,
    limit: number = 100
  ): Promise<OrderResult[]> {
    try {
      let query = 'SELECT * FROM orders WHERE user_id = $1';
      const params: any[] = [userId];
      let paramIndex = 2;

      if (exchange) {
        query += ` AND exchange = $${paramIndex++}`;
        params.push(exchange);
      }
      if (symbol) {
        query += ` AND symbol = $${paramIndex++}`;
        params.push(symbol);
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex++}`;
      params.push(limit);

      const result = await pool.query(query, params);

      return result.rows.map((row: any) => {
        // Handle timestamp conversion safely
        let timestamp: number;
        if (row.timestamp) {
          timestamp = typeof row.timestamp === 'number' 
            ? row.timestamp 
            : new Date(row.timestamp).getTime();
        } else if (row.created_at) {
          timestamp = row.created_at instanceof Date
            ? row.created_at.getTime()
            : new Date(row.created_at).getTime();
        } else {
          timestamp = Date.now();
        }

        return {
          orderId: row.order_id,
          symbol: row.symbol,
          side: row.side as 'buy' | 'sell',
          type: row.type,
          status: row.status,
          price: parseFloat(row.price || 0),
          quantity: parseFloat(row.quantity || 0),
          filledQuantity: parseFloat(row.filled_quantity || 0),
          remainingQuantity: parseFloat(row.remaining_quantity || 0),
          timestamp,
          exchange: row.exchange,
        };
      });
    } catch (error: any) {
      console.error('[OrderStore] Error fetching order history:', error);
      // If table doesn't exist or connection fails, return empty array
      if (error.code === '42P01' || error.code === 'ECONNREFUSED') {
        console.warn('[OrderStore] Database table or connection issue, returning empty array');
        return [];
      }
      throw error;
    }
  }

  /**
   * Get trade history (filtered by user_id)
   */
  async getTradeHistory(
    userId: number,
    exchange?: string,
    symbol?: string,
    limit: number = 100
  ): Promise<TradeFill[]> {
    try {
      let query = 'SELECT * FROM trades WHERE user_id = $1';
      const params: any[] = [userId];
      let paramIndex = 2;

      if (exchange) {
        query += ` AND exchange = $${paramIndex++}`;
        params.push(exchange);
      }
      if (symbol) {
        query += ` AND symbol = $${paramIndex++}`;
        params.push(symbol);
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex++}`;
      params.push(limit);

      const result = await pool.query(query, params);

      return result.rows.map((row: any) => {
        // Handle timestamp conversion safely
        let timestamp: number;
        if (row.timestamp) {
          timestamp = typeof row.timestamp === 'number' 
            ? row.timestamp 
            : new Date(row.timestamp).getTime();
        } else if (row.created_at) {
          timestamp = row.created_at instanceof Date
            ? row.created_at.getTime()
            : new Date(row.created_at).getTime();
        } else {
          timestamp = Date.now();
        }

        return {
          tradeId: row.trade_id,
          orderId: row.order_id,
          symbol: row.symbol,
          side: row.side as 'buy' | 'sell',
          price: parseFloat(row.price || 0),
          quantity: parseFloat(row.quantity || 0),
          fee: parseFloat(row.fee || 0),
          feeAsset: row.fee_asset,
          timestamp,
          exchange: row.exchange,
        };
      });
    } catch (error: any) {
      console.error('[OrderStore] Error fetching trade history:', error);
      // If table doesn't exist or connection fails, return empty array
      if (error.code === '42P01' || error.code === 'ECONNREFUSED') {
        console.warn('[OrderStore] Database table or connection issue, returning empty array');
        return [];
      }
      throw error;
    }
  }
}

// Export singleton instance
export const orderStore = new OrderStore();
