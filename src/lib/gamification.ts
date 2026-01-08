import { prisma } from '@/lib/prisma';

// Point values for different actions
export const POINTS = {
  REPORT_SUBMITTED: 10,
  VIDEO_UPLOADED: 25,
  VIDEO_GPS_VERIFIED: 10, // Bonus for GPS-verified videos
  FIRST_REPORT: 50,      // Bonus for first-ever report
  FIRST_VIDEO: 75,       // Bonus for first-ever video
} as const;

// Badge definitions
export const BADGES = {
  first_report: {
    id: 'first_report',
    name: 'First Report',
    description: 'Submitted your first vibe report',
    icon: '📝',
    requirement: { reportsCount: 1 },
  },
  reporter_5: {
    id: 'reporter_5',
    name: 'Regular Reporter',
    description: 'Submitted 5 vibe reports',
    icon: '📊',
    requirement: { reportsCount: 5 },
  },
  reporter_25: {
    id: 'reporter_25',
    name: 'Vibe Expert',
    description: 'Submitted 25 vibe reports',
    icon: '🎯',
    requirement: { reportsCount: 25 },
  },
  reporter_100: {
    id: 'reporter_100',
    name: 'Vibe Master',
    description: 'Submitted 100 vibe reports',
    icon: '👑',
    requirement: { reportsCount: 100 },
  },
  first_video: {
    id: 'first_video',
    name: 'Video Star',
    description: 'Uploaded your first live video',
    icon: '🎬',
    requirement: { videosCount: 1 },
  },
  videographer_5: {
    id: 'videographer_5',
    name: 'Videographer',
    description: 'Uploaded 5 live videos',
    icon: '📹',
    requirement: { videosCount: 5 },
  },
  videographer_25: {
    id: 'videographer_25',
    name: 'Scene Capturer',
    description: 'Uploaded 25 live videos',
    icon: '🎥',
    requirement: { videosCount: 25 },
  },
  points_100: {
    id: 'points_100',
    name: 'Contributor',
    description: 'Earned 100 points',
    icon: '⭐',
    requirement: { points: 100 },
  },
  points_500: {
    id: 'points_500',
    name: 'Super Contributor',
    description: 'Earned 500 points',
    icon: '🌟',
    requirement: { points: 500 },
  },
  points_1000: {
    id: 'points_1000',
    name: 'Legend',
    description: 'Earned 1000 points',
    icon: '💫',
    requirement: { points: 1000 },
  },
} as const;

export type BadgeId = keyof typeof BADGES;

/**
 * Award points to a user and check for new badges
 */
export async function awardPoints(
  userId: string,
  points: number,
  action: 'report' | 'video',
  gpsVerified?: boolean
): Promise<{
  pointsAwarded: number;
  newBadges: BadgeId[];
  totalPoints: number;
}> {
  // Get current user state
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      points: true,
      reportsCount: true,
      videosCount: true,
      badges: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  let totalPointsToAward = points;
  const newBadges: BadgeId[] = [];

  // Check for first-time bonuses
  if (action === 'report' && user.reportsCount === 0) {
    totalPointsToAward += POINTS.FIRST_REPORT;
  }
  if (action === 'video' && user.videosCount === 0) {
    totalPointsToAward += POINTS.FIRST_VIDEO;
  }

  // GPS verification bonus for videos
  if (action === 'video' && gpsVerified) {
    totalPointsToAward += POINTS.VIDEO_GPS_VERIFIED;
  }

  // Calculate new totals
  const newPoints = user.points + totalPointsToAward;
  const newReportsCount = action === 'report' ? user.reportsCount + 1 : user.reportsCount;
  const newVideosCount = action === 'video' ? user.videosCount + 1 : user.videosCount;

  // Check for new badges
  const currentBadges = new Set(user.badges);

  for (const [badgeId, badge] of Object.entries(BADGES)) {
    if (currentBadges.has(badgeId)) continue;

    const req = badge.requirement;
    let earned = false;

    if ('reportsCount' in req && newReportsCount >= req.reportsCount) {
      earned = true;
    }
    if ('videosCount' in req && newVideosCount >= req.videosCount) {
      earned = true;
    }
    if ('points' in req && newPoints >= req.points) {
      earned = true;
    }

    if (earned) {
      newBadges.push(badgeId as BadgeId);
    }
  }

  // Update user in database
  await prisma.user.update({
    where: { id: userId },
    data: {
      points: newPoints,
      reportsCount: newReportsCount,
      videosCount: newVideosCount,
      badges: {
        push: newBadges,
      },
    },
  });

  return {
    pointsAwarded: totalPointsToAward,
    newBadges,
    totalPoints: newPoints,
  };
}

/**
 * Get user's gamification stats
 */
export async function getUserStats(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      points: true,
      reportsCount: true,
      videosCount: true,
      badges: true,
    },
  });

  if (!user) return null;

  // Calculate next badge progress
  const earnedBadges = new Set(user.badges);
  const nextBadges = Object.entries(BADGES)
    .filter(([id]) => !earnedBadges.has(id))
    .map(([id, badge]) => {
      let progress = 0;
      let target = 0;
      let current = 0;

      if ('reportsCount' in badge.requirement) {
        target = badge.requirement.reportsCount;
        current = user.reportsCount;
        progress = Math.min(100, (current / target) * 100);
      } else if ('videosCount' in badge.requirement) {
        target = badge.requirement.videosCount;
        current = user.videosCount;
        progress = Math.min(100, (current / target) * 100);
      } else if ('points' in badge.requirement) {
        target = badge.requirement.points;
        current = user.points;
        progress = Math.min(100, (current / target) * 100);
      }

      return {
        badgeId: id,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        progress,
        current,
        target,
      };
    })
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 3); // Show top 3 upcoming badges

  return {
    points: user.points,
    reportsCount: user.reportsCount,
    videosCount: user.videosCount,
    badges: user.badges.map((badgeId: string) =>
      BADGES[badgeId as BadgeId]
    ),
    nextBadges,
  };
}

/**
 * Get leaderboard
 */
export async function getLeaderboard(limit: number = 10) {
  const users = await prisma.user.findMany({
    where: {
      points: { gt: 0 },
    },
    orderBy: {
      points: 'desc',
    },
    take: limit,
    select: {
      id: true,
      name: true,
      image: true,
      points: true,
      reportsCount: true,
      videosCount: true,
      badges: true,
    },
  });

  return users.map((user, index) => ({
    rank: index + 1,
    ...user,
    badgeCount: user.badges.length,
  }));
}
