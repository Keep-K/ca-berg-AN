/**
 * Rate Limiter for Exchange API Calls
 * Prevents exceeding exchange rate limits
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RequestRecord {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private limits: Map<string, RateLimitConfig>;
  private requests: Map<string, RequestRecord>;

  constructor() {
    this.limits = new Map();
    this.requests = new Map();
  }

  /**
   * Configure rate limit for an exchange
   */
  setLimit(exchange: string, maxRequests: number, windowMs: number = 60000): void {
    this.limits.set(exchange, { maxRequests, windowMs });
  }

  /**
   * Check if request is allowed and record it
   */
  async checkLimit(exchange: string): Promise<boolean> {
    const limit = this.limits.get(exchange);
    if (!limit) {
      return true; // No limit configured
    }

    const now = Date.now();
    const record = this.requests.get(exchange);

    if (!record || now >= record.resetTime) {
      // Reset window
      this.requests.set(exchange, {
        count: 1,
        resetTime: now + limit.windowMs,
      });
      return true;
    }

    if (record.count >= limit.maxRequests) {
      // Rate limit exceeded
      const waitTime = record.resetTime - now;
      await this.sleep(waitTime);
      return this.checkLimit(exchange); // Retry after wait
    }

    // Increment count
    record.count++;
    return true;
  }

  /**
   * Get remaining requests in current window
   */
  getRemaining(exchange: string): number {
    const limit = this.limits.get(exchange);
    const record = this.requests.get(exchange);

    if (!limit) {
      return Infinity;
    }

    if (!record || Date.now() >= record.resetTime) {
      return limit.maxRequests;
    }

    return Math.max(0, limit.maxRequests - record.count);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();
