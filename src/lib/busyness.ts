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
 * Implements the weighted average algorithm from ARCHITECTURE.md
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

  // Check if the most recent observation shows venue is closed (level = -1)
  // If so, return closed status directly
  const mostRecentObs = observations[0]; // Already sorted by timestamp desc
  if (mostRecentObs.level === -1) {
    return {
      level: -1, // Preserve closed status
      confidence: 1, // High confidence - we know it's closed
      trend: 'stable',
      lastUpdated: mostRecentObs.timestamp,
    };
  }

  // Filter out closed observations for averaging
  const openObs = observations.filter(obs => obs.level >= 0 && obs.level <= 100);

  if (openObs.length === 0) {
    return {
      level: 50,
      confidence: 0,
      trend: 'stable',
      lastUpdated: currentTime,
    };
  }

  // Calculate weighted average
  let totalWeightedLevel = 0;
  let totalWeight = 0;
  let crowdWeight = 0;

  for (const obs of openObs) {
    const ageInMinutes =
      (currentTime.getTime() - obs.timestamp.getTime()) / (1000 * 60);

    const recencyWeight = calculateRecencyWeight(ageInMinutes);

    let baseWeight: number;
    if (obs.source === 'provider') {
      baseWeight = 0.6;
    } else {
      // crowd source
      baseWeight = 0.4;
      crowdWeight += baseWeight * recencyWeight;
    }

    const finalWeight = baseWeight * recencyWeight;
    totalWeightedLevel += obs.level * finalWeight;
    totalWeight += finalWeight;
  }

  // Cap crowd data total weight at 1.2
  if (crowdWeight > 1.2) {
    const excessWeight = crowdWeight - 1.2;
    totalWeight -= excessWeight;
    totalWeightedLevel -= excessWeight * 50; // Assume average level for excess
  }

  // Calculate fused level
  const fusedLevel = totalWeight > 0 ? totalWeightedLevel / totalWeight : 50;

  // Calculate confidence
  const confidence = calculateConfidence(openObs, currentTime);

  // Calculate trend
  const trend = calculateTrend(openObs, currentTime);

  // Get most recent timestamp
  const lastUpdated = openObs[0].timestamp;

  return {
    level: Math.round(fusedLevel),
    confidence: Math.round(confidence * 100) / 100,
    trend,
    lastUpdated,
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

    // Check if the most recent observation shows venue is closed (level = -1)
    // If so, return closed status directly
    const mostRecentObs = venueObs[0]; // Already sorted by timestamp desc
    if (mostRecentObs.level === -1) {
      results.set(venueId, {
        level: -1, // Preserve closed status
        confidence: 1, // High confidence - we know it's closed
        trend: 'stable',
        lastUpdated: mostRecentObs.timestamp,
      });
      continue;
    }

    // Filter out closed observations for averaging (only use open observations)
    const openObs = venueObs.filter(obs => obs.level >= 0 && obs.level <= 100);

    if (openObs.length === 0) {
      results.set(venueId, {
        level: 50,
        confidence: 0,
        trend: 'stable',
        lastUpdated: currentTime,
      });
      continue;
    }

    // Same fusion logic as single venue
    let totalWeightedLevel = 0;
    let totalWeight = 0;
    let crowdWeight = 0;

    for (const obs of openObs) {
      const ageInMinutes =
        (currentTime.getTime() - obs.timestamp.getTime()) / (1000 * 60);

      const recencyWeight = calculateRecencyWeight(ageInMinutes);

      let baseWeight: number;
      if (obs.source === 'provider') {
        baseWeight = 0.6;
      } else {
        baseWeight = 0.4;
        crowdWeight += baseWeight * recencyWeight;
      }

      const finalWeight = baseWeight * recencyWeight;
      totalWeightedLevel += obs.level * finalWeight;
      totalWeight += finalWeight;
    }

    // Cap crowd data total weight at 1.2
    if (crowdWeight > 1.2) {
      const excessWeight = crowdWeight - 1.2;
      totalWeight -= excessWeight;
      totalWeightedLevel -= excessWeight * 50;
    }

    const fusedLevel = totalWeight > 0 ? totalWeightedLevel / totalWeight : 50;
    const confidence = calculateConfidence(openObs, currentTime);
    const trend = calculateTrend(openObs, currentTime);

    results.set(venueId, {
      level: Math.round(fusedLevel),
      confidence: Math.round(confidence * 100) / 100,
      trend,
      lastUpdated: openObs[0].timestamp,
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
