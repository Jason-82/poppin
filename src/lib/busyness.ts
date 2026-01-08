import { prisma } from './prisma';
import { BusynessSource, CrowdLevel } from '@prisma/client';

export interface FusedBusyness {
  level: number; // 0-100
  confidence: number; // 0-1
  trend: 'up' | 'down' | 'stable';
  lastUpdated: Date;
}

interface BusynessObservation {
  id: string;
  source: BusynessSource;
  level: number;
  timestamp: Date;
}

/**
 * Convert CrowdLevel enum to numeric value (0-100)
 */
export function crowdLevelToNumeric(level: CrowdLevel): number {
  const mapping: Record<CrowdLevel, number> = {
    dead: 12, // midpoint of 0-25
    warm: 38, // midpoint of 26-50
    busy: 63, // midpoint of 51-75
    packed: 88, // midpoint of 76-100
  };

  return mapping[level];
}

/**
 * Calculate the recency weight using exponential decay
 * Half-life of 30 minutes
 */
function calculateRecencyWeight(ageInMinutes: number): number {
  const halfLife = 30; // minutes
  return Math.exp(-ageInMinutes / halfLife);
}

/**
 * Calculate confidence based on data freshness, volume, and diversity
 */
function calculateConfidence(
  observations: BusynessObservation[],
  currentTime: Date
): number {
  if (observations.length === 0) return 0;

  // Find most recent observation
  const mostRecent = observations.reduce((latest, obs) =>
    obs.timestamp > latest.timestamp ? obs : latest
  );

  const mostRecentAge =
    (currentTime.getTime() - mostRecent.timestamp.getTime()) / (1000 * 60); // minutes

  // Recency factor: decays over 1 hour
  const recencyFactor = Math.max(0, 1 - mostRecentAge / 60);

  // Volume factor: saturates at 5 observations
  const volumeFactor = Math.min(1, observations.length / 5);

  // Diversity factor: bonus for having both provider and crowd data
  const hasBothSources = observations.some((o) => o.source === 'provider') &&
    observations.some((o) => o.source === 'crowd');
  const diversityFactor = hasBothSources ? 1.0 : 0.8;

  return recencyFactor * volumeFactor * diversityFactor;
}

/**
 * Calculate trend by comparing recent average to previous average
 */
function calculateTrend(
  observations: BusynessObservation[],
  currentTime: Date
): 'up' | 'down' | 'stable' {
  if (observations.length < 2) return 'stable';

  const now = currentTime.getTime();
  const thirtyMinAgo = now - 30 * 60 * 1000;
  const sixtyMinAgo = now - 60 * 60 * 1000;

  // Get observations from last 30 minutes
  const recentObs = observations.filter(
    (o) => o.timestamp.getTime() >= thirtyMinAgo
  );

  // Get observations from 30-60 minutes ago
  const previousObs = observations.filter(
    (o) =>
      o.timestamp.getTime() >= sixtyMinAgo &&
      o.timestamp.getTime() < thirtyMinAgo
  );

  // Need data from both periods to determine trend
  if (recentObs.length === 0 || previousObs.length === 0) {
    return 'stable';
  }

  const recentAvg =
    recentObs.reduce((sum, o) => sum + o.level, 0) / recentObs.length;
  const previousAvg =
    previousObs.reduce((sum, o) => sum + o.level, 0) / previousObs.length;

  const change = recentAvg - previousAvg;

  // Threshold of 10 points to avoid noise
  if (Math.abs(change) < 10) return 'stable';
  if (change > 0) return 'up';
  return 'down';
}

/**
 * Fuse busyness data from provider and crowd sources
 * Uses the most recent observation as the primary source
 * with confidence based on data freshness
 */
export async function fuseBusynessData(
  venueId: string,
  currentTime: Date = new Date()
): Promise<FusedBusyness> {
  // Fetch observations from last 2 hours
  const twoHoursAgo = new Date(currentTime.getTime() - 2 * 60 * 60 * 1000);

  const observations = await prisma.busynessObservation.findMany({
    where: {
      venueId,
      timestamp: {
        gte: twoHoursAgo,
      },
    },
    orderBy: {
      timestamp: 'desc',
    },
  });

  // No data available
  if (observations.length === 0) {
    return {
      level: 50,
      confidence: 0,
      trend: 'stable',
      lastUpdated: currentTime,
    };
  }

  // Use the most recent observation directly
  const mostRecentObs = observations[0];

  // Check if venue is closed
  if (mostRecentObs.level === -1) {
    return {
      level: -1,
      confidence: 1,
      trend: 'stable',
      lastUpdated: mostRecentObs.timestamp,
    };
  }

  // Calculate confidence based on recency
  const ageInMinutes = (currentTime.getTime() - mostRecentObs.timestamp.getTime()) / (1000 * 60);
  const recencyConfidence = Math.max(0, 1 - ageInMinutes / 60); // Decays over 1 hour

  // Calculate trend from historical data
  const trend = calculateTrend(observations, currentTime);

  return {
    level: Math.max(0, Math.min(100, mostRecentObs.level)),
    confidence: Math.round(recencyConfidence * 100) / 100,
    trend,
    lastUpdated: mostRecentObs.timestamp,
  };
}

/**
 * Get fused busyness for multiple venues efficiently
 */
export async function fuseBusynessDataBulk(
  venueIds: string[],
  currentTime: Date = new Date()
): Promise<Map<string, FusedBusyness>> {
  const twoHoursAgo = new Date(currentTime.getTime() - 2 * 60 * 60 * 1000);

  // Fetch all observations in one query
  const observations = await prisma.busynessObservation.findMany({
    where: {
      venueId: {
        in: venueIds,
      },
      timestamp: {
        gte: twoHoursAgo,
      },
    },
    orderBy: {
      timestamp: 'desc',
    },
  });

  // Group by venue
  const observationsByVenue = new Map<string, BusynessObservation[]>();
  for (const obs of observations) {
    if (!observationsByVenue.has(obs.venueId)) {
      observationsByVenue.set(obs.venueId, []);
    }
    observationsByVenue.get(obs.venueId)!.push(obs);
  }

  // Calculate fused busyness for each venue
  const results = new Map<string, FusedBusyness>();

  for (const venueId of venueIds) {
    const venueObs = observationsByVenue.get(venueId) || [];

    if (venueObs.length === 0) {
      results.set(venueId, {
        level: 50,
        confidence: 0,
        trend: 'stable',
        lastUpdated: currentTime,
      });
      continue;
    }

    // Use the most recent observation directly
    const mostRecentObs = venueObs[0]; // Already sorted by timestamp desc

    // Check if venue is closed
    if (mostRecentObs.level === -1) {
      results.set(venueId, {
        level: -1,
        confidence: 1,
        trend: 'stable',
        lastUpdated: mostRecentObs.timestamp,
      });
      continue;
    }

    // Calculate confidence based on recency
    const ageInMinutes = (currentTime.getTime() - mostRecentObs.timestamp.getTime()) / (1000 * 60);
    const recencyConfidence = Math.max(0, 1 - ageInMinutes / 60); // Decays over 1 hour

    // Calculate trend from historical data
    const trend = calculateTrend(venueObs, currentTime);

    results.set(venueId, {
      level: Math.max(0, Math.min(100, mostRecentObs.level)),
      confidence: Math.round(recencyConfidence * 100) / 100,
      trend,
      lastUpdated: mostRecentObs.timestamp,
    });
  }

  return results;
}

/**
 * Simple in-memory cache for fused busyness results
 * Cache for 5 minutes per venue
 */
const busynessCache = new Map<
  string,
  { data: FusedBusyness; expiresAt: number }
>();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getCachedFusedBusyness(
  venueId: string
): Promise<FusedBusyness> {
  const now = Date.now();
  const cached = busynessCache.get(venueId);

  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const data = await fuseBusynessData(venueId);

  busynessCache.set(venueId, {
    data,
    expiresAt: now + CACHE_TTL,
  });

  return data;
}

/**
 * Clear the busyness cache (for testing)
 */
export function clearBusynessCache(): void {
  busynessCache.clear();
}
