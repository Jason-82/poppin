/**
 * Simple in-memory rate limiter for MVP
 * For production, consider Redis-based rate limiting
 */

import crypto from 'crypto';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory stores for rate limiting
const ipStore = new Map<string, RateLimitEntry>();
const tokenStore = new Map<string, RateLimitEntry>();

// Cleanup interval to prevent memory leaks
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const MAX_STORE_SIZE = 10000; // Prevent unbounded growth

// Periodic cleanup
setInterval(() => {
  const now = Date.now();

  // Clean up IP store
  for (const [key, entry] of ipStore.entries()) {
    if (entry.resetAt < now) {
      ipStore.delete(key);
    }
  }

  // Clean up token store
  for (const [key, entry] of tokenStore.entries()) {
    if (entry.resetAt < now) {
      tokenStore.delete(key);
    }
  }

  // If stores are still too large, clear the oldest entries
  if (ipStore.size > MAX_STORE_SIZE) {
    const entries = Array.from(ipStore.entries());
    entries.sort((a, b) => a[1].resetAt - b[1].resetAt);
    entries.slice(0, Math.floor(MAX_STORE_SIZE / 2)).forEach(([key]) => {
      ipStore.delete(key);
    });
  }

  if (tokenStore.size > MAX_STORE_SIZE) {
    const entries = Array.from(tokenStore.entries());
    entries.sort((a, b) => a[1].resetAt - b[1].resetAt);
    entries.slice(0, Math.floor(MAX_STORE_SIZE / 2)).forEach(([key]) => {
      tokenStore.delete(key);
    });
  }
}, CLEANUP_INTERVAL);

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for a given identifier
 */
function checkRateLimit(
  store: Map<string, RateLimitEntry>,
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(identifier);

  // No entry or expired entry
  if (!entry || entry.resetAt < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    store.set(identifier, newEntry);

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: newEntry.resetAt,
    };
  }

  // Increment count
  entry.count += 1;

  // Check if limit exceeded
  if (entry.count > config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Rate limit by IP address
 * Default: 5 requests per hour
 */
export function rateLimitByIP(
  ipAddress: string,
  config: RateLimitConfig = {
    maxRequests: 5,
    windowMs: 60 * 60 * 1000, // 1 hour
  }
): RateLimitResult {
  return checkRateLimit(ipStore, ipAddress, config);
}

/**
 * Rate limit by browser token
 * Default: 10 requests per hour
 */
export function rateLimitByToken(
  browserToken: string,
  config: RateLimitConfig = {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
  }
): RateLimitResult {
  return checkRateLimit(tokenStore, browserToken, config);
}

/**
 * Check both IP and token rate limits
 * Returns true only if both are allowed
 */
export function checkReportRateLimit(
  ipAddress: string,
  browserToken: string
): { allowed: boolean; reason?: string; resetAt?: number } {
  const ipResult = rateLimitByIP(ipAddress);
  if (!ipResult.allowed) {
    return {
      allowed: false,
      reason: 'IP rate limit exceeded',
      resetAt: ipResult.resetAt,
    };
  }

  const tokenResult = rateLimitByToken(browserToken);
  if (!tokenResult.allowed) {
    return {
      allowed: false,
      reason: 'Browser token rate limit exceeded',
      resetAt: tokenResult.resetAt,
    };
  }

  return { allowed: true };
}

/**
 * Get the client IP address from the request
 * Handles various proxy headers
 */
export function getClientIP(request: Request): string {
  // Check various headers that proxies might use
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // Take the first IP if multiple are present
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }

  // Fallback to a default (should rarely happen)
  return 'unknown';
}

/**
 * Reset rate limit for testing purposes
 */
export function resetRateLimits(): void {
  ipStore.clear();
  tokenStore.clear();
}

/**
 * Hash IP address for privacy-preserving storage
 * Uses SHA-256 to create a one-way hash
 */
export function hashIP(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex');
}
