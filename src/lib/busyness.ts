import { prisma } from './prisma';
import { BusynessSource, CrowdLevel, VenueType } from '@prisma/client';
import { getExpectedBusyness, validateLiveReading } from './providers/google-utils';

export interface FusedBusyness {
  level: number; // 0-100
  confidence: number; // 0-1
  trend: 'up' | 'down' | 'stable';
  lastUpdated: Date;
  sanityCheck?: {
    isReasonable: boolean;
    reason: string;
  };
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
 * Source weights - crowd reports are weighted higher as they're from real users on-site
 */
const SOURCE_WEIGHTS: Record<string, number> = {
  crowd: 2.0,    // Crowd reports from users on-site - highest trust
  provider: 1.0, // Provider data (BestTime) - base weight, subject to sanity check
};

/**
 * Fuse busyness data from provider and crowd sources
 * - Crowd reports are weighted higher than provider data
 * - Provider data is sanity-checked against expected historical patterns
 * - Falls back to expected busyness when no live data available
 */
export async function fuseBusynessData(
  venueId: string,
  currentTime: Date = new Date(),
  venueType?: VenueType
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

  // Get venue type if not provided (needed for Google sanity check)
  let effectiveVenueType = venueType;
  if (!effectiveVenueType) {
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { type: true },
    });
    effectiveVenueType = venue?.type || 'bar';
  }

  // No data available - use Google expected busyness as fallback
  if (observations.length === 0) {
    const expected = getExpectedBusyness(effectiveVenueType, currentTime);
    return {
      level: expected.expectedLevel,
      confidence: expected.confidence * 0.3, // Low confidence since it's just historical
      trend: 'stable',
      lastUpdated: currentTime,
      sanityCheck: {
        isReasonable: true,
        reason: `No live data - using historical estimate: ${expected.description}`,
      },
    };
  }

  // Check if venue is closed (level === -1)
  const closedObs = observations.find(o => o.level === -1);
  if (closedObs) {
    return {
      level: -1,
      confidence: 1,
      trend: 'stable',
      lastUpdated: closedObs.timestamp,
    };
  }

  // Get expected busyness for sanity checking provider data
  const expected = getExpectedBusyness(effectiveVenueType, currentTime);

  // Separate crowd and provider observations
  const crowdObs = observations.filter((o: BusynessObservation) => o.source === 'crowd');
  const providerObs = observations.filter((o: BusynessObservation) => o.source === 'provider');

  // Calculate weighted average with time decay
  let weightedSum = 0;
  let totalWeight = 0;
  let mostRecentTimestamp = observations[0].timestamp;

  for (const obs of observations) {
    const ageInMinutes = (currentTime.getTime() - obs.timestamp.getTime()) / (1000 * 60);
    const recencyWeight = calculateRecencyWeight(ageInMinutes);
    const sourceWeight = SOURCE_WEIGHTS[obs.source] || 1.0;

    let effectiveLevel = obs.level;
    let sanityMultiplier = 1.0;

    // For provider data, apply sanity check and blend toward expected if suspicious
    if (obs.source === 'provider') {
      const validation = validateLiveReading(obs.level, effectiveVenueType, currentTime);
      sanityMultiplier = validation.confidenceMultiplier;

      // If reading is suspicious, blend it 50% toward expected value
      if (!validation.isReasonable) {
        effectiveLevel = Math.round(obs.level * 0.5 + expected.expectedLevel * 0.5);
      }
    }

    const finalWeight = recencyWeight * sourceWeight * sanityMultiplier;
    weightedSum += effectiveLevel * finalWeight;
    totalWeight += finalWeight;

    if (obs.timestamp > mostRecentTimestamp) {
      mostRecentTimestamp = obs.timestamp;
    }
  }

  // Calculate final level
  const fusedLevel = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;

  // Calculate confidence based on recency and data quality
  const mostRecentAge = (currentTime.getTime() - mostRecentTimestamp.getTime()) / (1000 * 60);
  const recencyConfidence = Math.max(0, 1 - mostRecentAge / 60);

  // Boost confidence if we have crowd reports (more trustworthy)
  const crowdBoost = crowdObs.length > 0 ? 1.2 : 1.0;

  // Final confidence capped at 1.0
  const finalConfidence = Math.min(1, recencyConfidence * crowdBoost);

  // Calculate trend from historical data
  const trend = calculateTrend(observations, currentTime);

  // Do a final sanity check on the fused result
  const finalValidation = validateLiveReading(fusedLevel, effectiveVenueType, currentTime);

  return {
    level: Math.max(0, Math.min(100, fusedLevel)),
    confidence: Math.round(finalConfidence * 100) / 100,
    trend,
    lastUpdated: mostRecentTimestamp,
    sanityCheck: {
      isReasonable: finalValidation.isReasonable,
      reason: finalValidation.reason,
    },
  };
}

/**
 * Get fused busyness for multiple venues efficiently
 * Uses same weighted fusion algorithm as single-venue version
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

  // Fetch venue types for sanity checks
  const venues = await prisma.venue.findMany({
    where: { id: { in: venueIds } },
    select: { id: true, type: true },
  });
  const venueTypeMap = new Map(venues.map((v: { id: string; type: VenueType }) => [v.id, v.type]));

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
    const venueType = venueTypeMap.get(venueId) || 'bar';

    // No data - use Google expected busyness as fallback
    if (venueObs.length === 0) {
      const expected = getExpectedBusyness(venueType, currentTime);
      results.set(venueId, {
        level: expected.expectedLevel,
        confidence: expected.confidence * 0.3, // Low confidence for historical estimate
        trend: 'stable',
        lastUpdated: currentTime,
        sanityCheck: {
          isReasonable: true,
          reason: `No live data - using historical estimate: ${expected.description}`,
        },
      });
      continue;
    }

    // Check if venue is closed
    const closedObs = venueObs.find(o => o.level === -1);
    if (closedObs) {
      results.set(venueId, {
        level: -1,
        confidence: 1,
        trend: 'stable',
        lastUpdated: closedObs.timestamp,
      });
      continue;
    }

    // Get expected busyness for sanity checking provider data
    const expected = getExpectedBusyness(venueType, currentTime);

    // Separate crowd and provider observations
    const crowdObs = venueObs.filter((o: BusynessObservation) => o.source === 'crowd');

    // Calculate weighted average with time decay and source weights
    let weightedSum = 0;
    let totalWeight = 0;
    let mostRecentTimestamp = venueObs[0].timestamp;

    for (const obs of venueObs) {
      const ageInMinutes = (currentTime.getTime() - obs.timestamp.getTime()) / (1000 * 60);
      const recencyWeight = calculateRecencyWeight(ageInMinutes);
      const sourceWeight = SOURCE_WEIGHTS[obs.source] || 1.0;

      let effectiveLevel = obs.level;
      let sanityMultiplier = 1.0;

      // For provider data, apply sanity check and blend toward expected if suspicious
      if (obs.source === 'provider') {
        const validation = validateLiveReading(obs.level, venueType, currentTime);
        sanityMultiplier = validation.confidenceMultiplier;

        // If reading is suspicious, blend it 50% toward expected value
        if (!validation.isReasonable) {
          effectiveLevel = Math.round(obs.level * 0.5 + expected.expectedLevel * 0.5);
        }
      }

      const finalWeight = recencyWeight * sourceWeight * sanityMultiplier;
      weightedSum += effectiveLevel * finalWeight;
      totalWeight += finalWeight;

      if (obs.timestamp > mostRecentTimestamp) {
        mostRecentTimestamp = obs.timestamp;
      }
    }

    // Calculate final level
    const fusedLevel = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;

    // Calculate confidence based on recency and data quality
    const mostRecentAge = (currentTime.getTime() - mostRecentTimestamp.getTime()) / (1000 * 60);
    const recencyConfidence = Math.max(0, 1 - mostRecentAge / 60);

    // Boost confidence if we have crowd reports
    const crowdBoost = crowdObs.length > 0 ? 1.2 : 1.0;
    const finalConfidence = Math.min(1, recencyConfidence * crowdBoost);

    // Calculate trend from historical data
    const trend = calculateTrend(venueObs, currentTime);

    // Final sanity check
    const finalValidation = validateLiveReading(fusedLevel, venueType, currentTime);

    results.set(venueId, {
      level: Math.max(0, Math.min(100, fusedLevel)),
      confidence: Math.round(finalConfidence * 100) / 100,
      trend,
      lastUpdated: mostRecentTimestamp,
      sanityCheck: {
        isReasonable: finalValidation.isReasonable,
        reason: finalValidation.reason,
      },
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
