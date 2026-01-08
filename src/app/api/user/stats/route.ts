import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getUserStats } from '@/lib/gamification';

/**
 * GET /api/user/stats
 * Get current user's gamification stats
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const stats = await getUserStats(session.user.id);

    if (!stats) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error in GET /api/user/stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
