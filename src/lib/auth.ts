import { cookies } from 'next/headers';
import crypto from 'crypto';

const COOKIE_NAME = 'poppin-auth';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

/**
 * Constant-time string comparison to prevent timing attacks
 * Uses crypto.timingSafeEqual for secure comparison
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (!a || !b) {
    return false;
  }

  // Convert strings to buffers for comparison
  // Pad to same length to prevent length-based timing attacks
  const maxLength = Math.max(a.length, b.length);
  const bufferA = Buffer.alloc(maxLength);
  const bufferB = Buffer.alloc(maxLength);

  bufferA.write(a);
  bufferB.write(b);

  try {
    return crypto.timingSafeEqual(bufferA, bufferB);
  } catch {
    return false;
  }
}

/**
 * Verifies the passcode against the environment variable
 */
export function verifyPasscode(passcode: string): boolean {
  const appPasscode = process.env.APP_PASSCODE;

  if (!appPasscode) {
    console.error('APP_PASSCODE environment variable is not set');
    return false;
  }

  return constantTimeCompare(passcode, appPasscode);
}

/**
 * Sets the authentication cookie
 */
export async function setAuthCookie(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, 'authenticated', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

/**
 * Checks if the user is authenticated by verifying the cookie
 */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get(COOKIE_NAME);

  return !!authCookie && authCookie.value === 'authenticated';
}

/**
 * Clears the authentication cookie
 */
export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Generates a random browser token for tracking users
 * Used for rate limiting and abuse prevention
 */
export function generateBrowserToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Gets or creates a browser token from cookies
 */
export async function getBrowserToken(): Promise<string> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get('poppin-browser-token');

  if (tokenCookie?.value) {
    return tokenCookie.value;
  }

  // Generate new token
  const newToken = generateBrowserToken();

  cookieStore.set('poppin-browser-token', newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 365 * 24 * 60 * 60, // 1 year
    path: '/',
  });

  return newToken;
}
