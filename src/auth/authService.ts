/**
 * Auth Service
 * User registration, login, JWT issuance
 */

import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config';

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.database,
  user: config.database.user,
  password: String(config.database.password || 'postgres'),
});

const SALT_ROUNDS = 10;

export interface RegisterInput {
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  userId: number;
  email: string;
  token: string;
  expiresIn: string;
}

/**
 * Register a new user
 */
export async function register(input: RegisterInput): Promise<{ userId: number; email: string }> {
  const { email, password } = input;
  if (!email || !password) {
    throw new Error('Email and password are required');
  }
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const result = await pool.query(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email`,
    [email.trim().toLowerCase(), passwordHash]
  );
  const row = result.rows[0];
  return { userId: row.id, email: row.email };
}

/**
 * Login: verify password and return JWT
 */
export async function login(input: LoginInput): Promise<AuthResult> {
  const { email, password } = input;
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  const result = await pool.query(
    `SELECT id, email, password_hash FROM users WHERE email = $1`,
    [email.trim().toLowerCase()]
  );
  const user = result.rows[0];
  if (!user) {
    throw new Error('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new Error('Invalid email or password');
  }

  const options: jwt.SignOptions = { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] };
  const token = jwt.sign(
    { userId: user.id },
    config.jwt.secret,
    options
  );

  return {
    userId: user.id,
    email: user.email,
    token,
    expiresIn: config.jwt.expiresIn,
  };
}

/**
 * Verify JWT and return payload (userId)
 */
export function verifyToken(token: string): { userId: number } {
  const decoded = jwt.verify(token, config.jwt.secret) as { userId: number };
  return decoded;
}

/**
 * Ensure dev account exists when users table is empty (for development)
 * Returns { email, password } if created, null otherwise
 */
export async function ensureDevAccount(): Promise<{ email: string; password: string } | null> {
  const countResult = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  if (countResult.rows[0].count > 0) return null;

  const password = generateRandomPassword(10);
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  await pool.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2)',
    ['dev@platform.local', passwordHash]
  );
  return { email: 'dev@platform.local', password };
}

function generateRandomPassword(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
