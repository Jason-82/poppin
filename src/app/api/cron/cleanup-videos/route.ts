import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredVideos, getVideoStats } from '@/lib/videoCleanup';

/**
 * GET /api/cron/cleanup-videos
 * Cron job endpoint to clean up expired videos
 *
 * This endpoint can be called by external cron services like:
 * - Vercel Cron Jobs
 * - GitHub Actions scheduled workflows
 * - External cron services (cron-job.org, EasyCron, etc.)
 *
 * For security, you should:
 * 1. Add an authorization header check (e.g., Bearer token)
 * 2. Or restrict by IP address
 * 3. Or use Vercel Cron's built-in authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Optional: Add authorization check
    // const authHeader = request.headers.get('authorization');
    // const expectedToken = process.env.CRON_SECRET;
    //
    // if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    //   return NextResponse.json(
    //     { error: 'Unauthorized' },
    //     { status: 401 }
    //   );
    // }

    // Get stats before cleanup
    const statsBefore = await getVideoStats();

    // Cleanup expired videos
    const deletedCount = await cleanupExpiredVideos();

    // Get stats after cleanup
    const statsAfter = await getVideoStats();

    return NextResponse.json({
      success: true,
      deletedCount,
      statsBefore,
      statsAfter,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in cleanup-videos cron job:', error);
    return NextResponse.json(
      {
        error: 'Failed to cleanup videos',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/cleanup-videos
 * Alternative endpoint for POST-based cron jobs
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
