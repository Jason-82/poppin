import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware to protect routes with authentication
 * Checks for valid 'poppin-auth' cookie
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow auth verification endpoint without authentication
  if (pathname === '/api/auth/verify') {
    return NextResponse.next();
  }

  // Check for authentication cookie
  const authCookie = request.cookies.get('poppin-auth');
  const isAuthenticated = authCookie?.value === 'authenticated';

  // Protect API routes (except auth)
  if (pathname.startsWith('/api/')) {
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Unauthorized. Please authenticate first.' },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // For page routes, let client-side PasscodeGate handle authentication
  // This allows the page to load and show the passcode modal
  return NextResponse.next();
}

/**
 * Configure which routes the middleware should run on
 */
export const config = {
  matcher: [
    '/api/:path*', // Protect all API routes
    '/map/:path*', // Protect map page
    '/venue/:path*', // Protect venue pages
    '/favorites/:path*', // Protect favorites page
  ],
};
