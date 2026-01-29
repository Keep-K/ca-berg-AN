/**
 * Express request extension for JWT auth
 */
declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

export {};
