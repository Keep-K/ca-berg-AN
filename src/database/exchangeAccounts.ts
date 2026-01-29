/**
 * Exchange accounts persistence (per-user API keys)
 */

import { Pool } from 'pg';
import { config } from '../config';
import { keyManager } from '../security/keyManager';
import { ExchangeCredentials, EncryptedCredentials } from '../types';

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.database,
  user: config.database.user,
  password: String(config.database.password || 'postgres'),
});

/**
 * Load decrypted credentials for a user (all exchanges)
 */
export async function getCredentialsByUserId(userId: number): Promise<ExchangeCredentials[]> {
  const result = await pool.query(
    `SELECT exchange, encrypted_api_key, encrypted_api_secret, encrypted_passphrase, sandbox
     FROM exchange_accounts WHERE user_id = $1`,
    [userId]
  );

  const credentials: ExchangeCredentials[] = [];
  for (const row of result.rows) {
    const encrypted: EncryptedCredentials = {
      exchange: row.exchange,
      encryptedApiKey: row.encrypted_api_key,
      encryptedApiSecret: row.encrypted_api_secret,
      encryptedPassphrase: row.encrypted_passphrase || undefined,
      sandbox: row.sandbox || false,
    };
    credentials.push(keyManager.decryptCredentials(encrypted));
  }
  return credentials;
}

/**
 * Save encrypted credentials for a user (upsert per exchange)
 */
export async function saveCredentials(
  userId: number,
  credentials: ExchangeCredentials
): Promise<void> {
  const encrypted = keyManager.encryptCredentials(credentials);
  await pool.query(
    `INSERT INTO exchange_accounts (user_id, exchange, encrypted_api_key, encrypted_api_secret, encrypted_passphrase, sandbox)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, exchange) DO UPDATE SET
       encrypted_api_key = EXCLUDED.encrypted_api_key,
       encrypted_api_secret = EXCLUDED.encrypted_api_secret,
       encrypted_passphrase = EXCLUDED.encrypted_passphrase,
       sandbox = EXCLUDED.sandbox`,
    [
      userId,
      credentials.exchange.toLowerCase(),
      encrypted.encryptedApiKey,
      encrypted.encryptedApiSecret,
      encrypted.encryptedPassphrase ?? null,
      credentials.sandbox ?? false,
    ]
  );
}

/**
 * Remove exchange for a user
 */
export async function removeCredentials(userId: number, exchange: string): Promise<void> {
  await pool.query(
    `DELETE FROM exchange_accounts WHERE user_id = $1 AND exchange = $2`,
    [userId, exchange.toLowerCase()]
  );
}
