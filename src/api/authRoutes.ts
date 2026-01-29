/**
 * Auth API routes (no JWT required)
 */

import { Router, Request, Response } from 'express';
import * as authService from '../auth/authService';

export function createAuthRoutes(): Router {
  const router = Router();

  /**
   * POST /api/auth/register
   */
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const user = await authService.register({ email, password });
      res.status(201).json({
        success: true,
        userId: user.userId,
        email: user.email,
      });
    } catch (error: any) {
      if (error.message?.includes('duplicate') || error.code === '23505') {
        return res.status(400).json({ error: 'Email already registered' });
      }
      res.status(400).json({ error: error.message || 'Registration failed' });
    }
  });

  /**
   * POST /api/auth/login
   */
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const result = await authService.login({ email, password });
      res.json({
        success: true,
        userId: result.userId,
        email: result.email,
        token: result.token,
        expiresIn: result.expiresIn,
      });
    } catch (error: any) {
      res.status(401).json({ error: error.message || 'Login failed' });
    }
  });

  return router;
}
