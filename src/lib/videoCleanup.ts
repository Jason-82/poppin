/**
 * Video cleanup utility for removing expired venue videos
 * This can be called from a cron job or API endpoint
 */

import { prisma } from '@/lib/prisma';

/**
 * Delete all expired videos from the database
 * Returns the number of videos deleted
 */
export async function cleanupExpiredVideos(): Promise<number> {
  try {
    const now = new Date();

    // Find expired videos
    const expiredVideos = await prisma.venueVideo.findMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
      select: {
        id: true,
      },
    });

    if (expiredVideos.length === 0) {
      console.log('[Video Cleanup] No expired videos found');
      return 0;
    }

    // Delete expired videos
    const result = await prisma.venueVideo.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    });

    console.log(`[Video Cleanup] Deleted ${result.count} expired videos`);
    return result.count;
  } catch (error) {
    console.error('[Video Cleanup] Error cleaning up expired videos:', error);
    throw error;
  }
}

/**
 * Delete videos older than a specific age (in hours)
 * Useful for additional cleanup beyond the standard 4-hour expiration
 */
export async function cleanupOldVideos(ageInHours: number = 24): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - ageInHours * 60 * 60 * 1000);

    const result = await prisma.venueVideo.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    console.log(
      `[Video Cleanup] Deleted ${result.count} videos older than ${ageInHours} hours`
    );
    return result.count;
  } catch (error) {
    console.error('[Video Cleanup] Error cleaning up old videos:', error);
    throw error;
  }
}

/**
 * Get statistics about videos in the database
 */
export async function getVideoStats(): Promise<{
  total: number;
  active: number;
  expired: number;
  totalSizeEstimate: string;
}> {
  try {
    const now = new Date();

    const [total, active] = await Promise.all([
      prisma.venueVideo.count(),
      prisma.venueVideo.count({
        where: {
          expiresAt: {
            gt: now,
          },
        },
      }),
    ]);

    const expired = total - active;

    // Note: Size estimation is rough since we're storing base64 in the database
    // In production with external storage, this would query the actual file sizes
    const estimatedSizePerVideo = 10; // MB estimate
    const totalSizeMB = total * estimatedSizePerVideo;

    return {
      total,
      active,
      expired,
      totalSizeEstimate: `~${totalSizeMB} MB`,
    };
  } catch (error) {
    console.error('[Video Cleanup] Error getting video stats:', error);
    throw error;
  }
}

/**
 * Clean up videos for a specific venue
 */
export async function cleanupVenueVideos(venueId: string): Promise<number> {
  try {
    const now = new Date();

    const result = await prisma.venueVideo.deleteMany({
      where: {
        venueId,
        expiresAt: {
          lt: now,
        },
      },
    });

    console.log(
      `[Video Cleanup] Deleted ${result.count} expired videos for venue ${venueId}`
    );
    return result.count;
  } catch (error) {
    console.error(
      `[Video Cleanup] Error cleaning up videos for venue ${venueId}:`,
      error
    );
    throw error;
  }
}
