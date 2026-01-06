import { NextRequest, NextResponse } from 'next/server';
import { verifyPasscode, setAuthCookie } from '@/lib/auth';

/**
 * POST /api/auth/verify
 * Verifies the app-level passcode and sets authentication cookie
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { passcode } = body;

    // Validate input
    if (!passcode || typeof passcode !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Passcode is required' },
        { status: 400 }
      );
    }

    // Verify passcode using constant-time comparison
    const isValid = verifyPasscode(passcode);

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid passcode' },
        { status: 401 }
      );
    }

    // Set authentication cookie
    await setAuthCookie();

    return NextResponse.json(
      { success: true, message: 'Access granted' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in /api/auth/verify:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
