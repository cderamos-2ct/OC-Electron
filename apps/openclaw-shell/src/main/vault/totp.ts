// TOTP Generator — RFC 6238 time-based one-time passwords
// Pure Node.js implementation, no external dependencies
// Compatible with Google Authenticator, Authy, etc.

import { createHmac } from 'crypto';

// ─── Types ──────────────────────────────────────────────────────

export interface TOTPResult {
  code: string;
  remainingSeconds: number;
  period: number;
}

export type TOTPAlgorithm = 'SHA1' | 'SHA256' | 'SHA512';

export interface TOTPOptions {
  period?: number;       // Time step in seconds (default: 30)
  digits?: number;       // Code length (default: 6)
  algorithm?: TOTPAlgorithm; // HMAC algorithm (default: SHA1)
}

// ─── Base32 Decoding ────────────────────────────────────────────

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(encoded: string): Buffer {
  // Strip spaces, dashes, and padding; uppercase
  const clean = encoded.replace(/[\s=-]/g, '').toUpperCase();

  let bits = '';
  for (const char of clean) {
    const idx = BASE32_CHARS.indexOf(char);
    if (idx === -1) continue; // skip invalid chars
    bits += idx.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }

  return Buffer.from(bytes);
}

// ─── HOTP (RFC 4226) ────────────────────────────────────────────

function generateHOTP(
  secret: Buffer,
  counter: bigint,
  digits: number,
  algorithm: TOTPAlgorithm,
): string {
  // Counter as 8-byte big-endian buffer
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(counter);

  // HMAC
  const hmacAlg = algorithm.toLowerCase().replace('sha', 'sha'); // sha1, sha256, sha512
  const hmac = createHmac(hmacAlg, secret);
  hmac.update(counterBuf);
  const hash = hmac.digest();

  // Dynamic truncation (RFC 4226 section 5.4)
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, digits);
  return otp.toString().padStart(digits, '0');
}

// ─── TOTP (RFC 6238) ────────────────────────────────────────────

/**
 * Generate a TOTP code from a base32-encoded secret.
 *
 * @param secret Base32-encoded TOTP secret (e.g., from a QR code)
 * @param options Optional: period, digits, algorithm
 * @returns TOTP code, remaining seconds, and period
 */
export function generateTOTP(secret: string, options?: TOTPOptions): TOTPResult {
  const period = options?.period ?? 30;
  const digits = options?.digits ?? 6;
  const algorithm = options?.algorithm ?? 'SHA1';

  const secretBytes = base32Decode(secret);
  const now = Math.floor(Date.now() / 1000);
  const counter = BigInt(Math.floor(now / period));
  const remainingSeconds = period - (now % period);

  const code = generateHOTP(secretBytes, counter, digits, algorithm);

  return { code, remainingSeconds, period };
}

// ─── otpauth:// URI Parsing ─────────────────────────────────────

export interface OTPAuthURI {
  secret: string;
  issuer?: string;
  account?: string;
  algorithm?: TOTPAlgorithm;
  digits?: number;
  period?: number;
}

/**
 * Parse an otpauth:// URI (from QR codes).
 * Format: otpauth://totp/Label?secret=BASE32&issuer=Issuer&algorithm=SHA1&digits=6&period=30
 */
export function parseOTPAuthURI(uri: string): OTPAuthURI {
  const url = new URL(uri);

  if (url.protocol !== 'otpauth:') {
    throw new Error('Not an otpauth URI');
  }

  const secret = url.searchParams.get('secret');
  if (!secret) {
    throw new Error('Missing secret parameter');
  }

  // Label is in the path: /totp/Issuer:Account or /totp/Account
  const pathParts = decodeURIComponent(url.pathname).replace(/^\/+/, '').split(':');
  const account = pathParts.length > 1 ? pathParts[1] : pathParts[0];
  const issuerFromPath = pathParts.length > 1 ? pathParts[0] : undefined;

  const algorithm = (url.searchParams.get('algorithm')?.toUpperCase() as TOTPAlgorithm) ?? undefined;
  const digits = url.searchParams.get('digits') ? parseInt(url.searchParams.get('digits')!, 10) : undefined;
  const period = url.searchParams.get('period') ? parseInt(url.searchParams.get('period')!, 10) : undefined;

  return {
    secret,
    issuer: url.searchParams.get('issuer') ?? issuerFromPath,
    account,
    algorithm,
    digits,
    period,
  };
}
