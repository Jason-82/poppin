import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fuseBusynessData } from '@/lib/busyness';

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

    const venuesWithBatch = venues.map((v, index) => ({
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
    venues.map(async (venue) => {
      const position = allVenues.findIndex((v) => v.id === venue.id);
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

      // Get fused busyness
      const busyness = await fuseBusynessData(venue.id);

      return {
        venue: {
          id: venue.id,
          name: venue.name,
          position,
          batch,
        },
        busyness,
        recentObservations: observations.map((o) => ({
          source: o.source,
          level: o.level,
          timestamp: o.timestamp.toISOString(),
          ageMinutes: Math.round((Date.now() - o.timestamp.getTime()) / 60000),
        })),
      };
    })
  );

  return NextResponse.json(results);
}
