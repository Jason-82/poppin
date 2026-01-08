import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/gamification';

/**
 * GET /api/leaderboard
 * Get top contributors leaderboard
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '10', 10),
      50 // Max 50 entries
    );

    const leaderboard = await getLeaderboard(limit);

    return NextResponse.json({
      leaderboard,
      count: leaderboard.length,
    });
  } catch (error) {
    console.error('Error in GET /api/leaderboard:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
