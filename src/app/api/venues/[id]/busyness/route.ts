import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fuseBusynessData } from '@/lib/busyness';

/**
 * GET /api/venues/[id]/busyness
 * Retrieves fused busyness data and historical observations for a venue
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: venueId } = await context.params;
    const { searchParams } = new URL(request.url);

    // Parse hours parameter (default 24, max 168)
    const hoursParam = searchParams.get('hours');
    let hours = 24;

    if (hoursParam) {
      const parsedHours = parseInt(hoursParam, 10);
      if (isNaN(parsedHours) || parsedHours < 1) {
        return NextResponse.json(
          { error: 'Invalid hours parameter' },
          { status: 400 }
        );
      }
      hours = Math.min(parsedHours, 168); // Max 1 week
    }

    // Verify venue exists
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, name: true },
    });

    if (!venue) {
      return NextResponse.json(
        { error: 'Venue not found' },
        { status: 404 }
      );
    }

    // Get current fused busyness
    const current = await fuseBusynessData(venueId);

    // Get historical observations
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const observations = await prisma.busynessObservation.findMany({
      where: {
        venueId,
        timestamp: {
          gte: startTime,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    // Format historical data
    const history = observations.map((obs) => ({
      timestamp: obs.timestamp.toISOString(),
      level: obs.level,
      source: obs.source,
    }));

    // Aggregate into hourly buckets for cleaner charting
    const hourlyBuckets = aggregateIntoHourlyBuckets(observations);

    return NextResponse.json(
      {
        venueId: venue.id,
        venueName: venue.name,
        current: {
          level: current.level,
          confidence: current.confidence,
          trend: current.trend,
          lastUpdated: current.lastUpdated.toISOString(),
        },
        history: hourlyBuckets,
        rawHistory: history, // Include raw data as well
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in /api/venues/[id]/busyness:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Aggregate observations into hourly buckets for cleaner visualization
 */
function aggregateIntoHourlyBuckets(
  observations: Array<{
    id: string;
    source: string;
    level: number;
    timestamp: Date;
  }>
) {
  if (observations.length === 0) return [];

  // Group by hour
  const buckets = new Map<
    string,
    {
      timestamp: Date;
      providerLevels: number[];
      crowdLevels: number[];
    }
  >();

  for (const obs of observations) {
    // Round down to the hour
    const hourKey = new Date(obs.timestamp);
    hourKey.setMinutes(0, 0, 0);
    const key = hourKey.toISOString();

    if (!buckets.has(key)) {
      buckets.set(key, {
        timestamp: hourKey,
        providerLevels: [],
        crowdLevels: [],
      });
    }

    const bucket = buckets.get(key)!;
    if (obs.source === 'provider') {
      bucket.providerLevels.push(obs.level);
    } else {
      bucket.crowdLevels.push(obs.level);
    }
  }

  // Calculate averages for each bucket
  const result = [];
  for (const [, bucket] of buckets) {
    const providerAvg =
      bucket.providerLevels.length > 0
        ? Math.round(
            bucket.providerLevels.reduce((a, b) => a + b, 0) /
              bucket.providerLevels.length
          )
        : null;

    const crowdAvg =
      bucket.crowdLevels.length > 0
        ? Math.round(
            bucket.crowdLevels.reduce((a, b) => a + b, 0) /
              bucket.crowdLevels.length
          )
        : null;

    // Calculate fused level if we have data
    let fusedLevel = null;
    if (providerAvg !== null && crowdAvg !== null) {
      // Simple weighted average for historical data
      fusedLevel = Math.round(providerAvg * 0.6 + crowdAvg * 0.4);
    } else if (providerAvg !== null) {
      fusedLevel = providerAvg;
    } else if (crowdAvg !== null) {
      fusedLevel = crowdAvg;
    }

    result.push({
      timestamp: bucket.timestamp.toISOString(),
      providerLevel: providerAvg,
      crowdLevel: crowdAvg,
      fusedLevel,
    });
  }

  return result;
}
