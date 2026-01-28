/**
 * Key Management Service (Mock KMS abstraction)
 * Handles encryption/decryption of API keys at rest
 */

import CryptoJS from 'crypto-js';
import { ExchangeCredentials, EncryptedCredentials } from '../types';
import { config } from '../config';

export class KeyManager {
  private encryptionKey: string;

  constructor() {
    this.encryptionKey = config.security.encryptionKey;
    if (!this.encryptionKey || this.encryptionKey.length < 32) {
      throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
    }
  }

  /**
   * Encrypt API credentials
   */
  encryptCredentials(credentials: ExchangeCredentials): EncryptedCredentials {
    const encrypted: EncryptedCredentials = {
      exchange: credentials.exchange,
      encryptedApiKey: this.encrypt(credentials.apiKey),
      encryptedApiSecret: this.encrypt(credentials.apiSecret),
      sandbox: credentials.sandbox,
    };

    if (credentials.passphrase) {
      encrypted.encryptedPassphrase = this.encrypt(credentials.passphrase);
    }

    return encrypted;
  }

  /**
   * Decrypt API credentials
   */
  decryptCredentials(encrypted: EncryptedCredentials): ExchangeCredentials {
    const credentials: ExchangeCredentials = {
      exchange: encrypted.exchange,
      apiKey: this.decrypt(encrypted.encryptedApiKey),
      apiSecret: this.decrypt(encrypted.encryptedApiSecret),
      sandbox: encrypted.sandbox,
    };

    if (encrypted.encryptedPassphrase) {
      credentials.passphrase = this.decrypt(encrypted.encryptedPassphrase);
    }

    return credentials;
  }

  /**
   * Encrypt a string value
   */
  private encrypt(value: string): string {
    return CryptoJS.AES.encrypt(value, this.encryptionKey).toString();
  }

  /**
   * Decrypt a string value
   */
  private decrypt(encryptedValue: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedValue, this.encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Mask API key for logging (only show first 4 and last 4 characters)
   */
  maskApiKey(apiKey: string): string {
    if (apiKey.length <= 8) {
      return '****';
    }
    return `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
  }

  /**
   * Validate that credentials are not logged
   */
  sanitizeForLogging(credentials: ExchangeCredentials): Record<string, any> {
    return {
      exchange: credentials.exchange,
      apiKey: this.maskApiKey(credentials.apiKey),
      apiSecret: '****',
      passphrase: credentials.passphrase ? '****' : undefined,
      sandbox: credentials.sandbox,
    };
  }
}

// Singleton instance
export const keyManager = new KeyManager();
