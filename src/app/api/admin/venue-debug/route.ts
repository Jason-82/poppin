import { NextRequest, NextResponse } from 'next/server';
import { VenueType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { fuseBusynessData } from '@/lib/busyness';
import { getExpectedBusyness, validateLiveReading } from '@/lib/providers/google-utils';

interface VenueWithType {
  id: string;
  name: string;
  address: string;
  neighborhood: string | null;
  latitude: number;
  longitude: number;
  type: VenueType;
  googlePlaceId: string | null;
  description: string | null;
  phoneNumber: string | null;
  website: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface BusynessObs {
  id: string;
  source: string;
  level: number;
  timestamp: Date;
}

/**
 * GET /api/admin/venue-debug?name=<venue_name>
 * Debug endpoint to check venue data and recent observations
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');

  if (!name) {
    // List all venues with their batch info
    const venues = await prisma.venue.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });

    const venuesWithBatch = venues.map((v: { id: string; name: string }, index: number) => ({
      position: index,
      batch: (index % 8) + 1,
      name: v.name,
      id: v.id,
    }));

    // Filter to show only venues matching partial name if provided
    return NextResponse.json({
      total: venues.length,
      venues: venuesWithBatch,
    });
  }

  // Search for venue by name (case-insensitive partial match)
  const venues = await prisma.venue.findMany({
    where: {
      name: {
        contains: name,
        mode: 'insensitive',
      },
    },
  });

  if (venues.length === 0) {
    return NextResponse.json({ error: 'No venues found matching that name' }, { status: 404 });
  }

  // Get all venues sorted to find position
  const allVenues = await prisma.venue.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  const results = await Promise.all(
    venues.map(async (venue: VenueWithType) => {
      const position = allVenues.findIndex((v: { id: string; name: string }) => v.id === venue.id);
      const batch = (position % 8) + 1;

      // Get recent observations
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const observations = await prisma.busynessObservation.findMany({
        where: {
          venueId: venue.id,
          timestamp: { gte: twoHoursAgo },
        },
        orderBy: { timestamp: 'desc' },
        take: 10,
      });

      // Get fused busyness (now includes sanity check)
      const busyness = await fuseBusynessData(venue.id, new Date(), venue.type);

      // Get expected busyness for comparison
      const expected = getExpectedBusyness(venue.type);

      return {
        venue: {
          id: venue.id,
          name: venue.name,
          type: venue.type,
          position,
          batch,
        },
        busyness,
        expected: {
          level: expected.expectedLevel,
          confidence: expected.confidence,
          description: expected.description,
        },
        recentObservations: observations.map((o: BusynessObs) => {
          const validation = validateLiveReading(o.level, venue.type);
          return {
            source: o.source,
            level: o.level,
            timestamp: o.timestamp.toISOString(),
            ageMinutes: Math.round((Date.now() - o.timestamp.getTime()) / 60000),
            sanityCheck: {
              isReasonable: validation.isReasonable,
              confidenceMultiplier: validation.confidenceMultiplier,
              reason: validation.reason,
            },
          };
        }),
      };
    })
  );

  return NextResponse.json(results);
}
