/**
 * JWT authentication middleware
 * Extracts Bearer token, verifies JWT, sets req.userId
 */

import { Request, Response, NextFunction } from 'express';
import * as authService from '../auth/authService';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization required', code: 'UNAUTHORIZED' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const { userId } = authService.verifyToken(token);
    req.userId = userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token', code: 'UNAUTHORIZED' });
  }
}
