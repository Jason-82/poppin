import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fuseBusynessDataBulk } from '@/lib/busyness';
import { VenueType } from '@prisma/client';

// Helper to get current Chicago time
function getChicagoTime(): { day: number; hour: number } {
  const now = new Date();
  const chicagoTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  return {
    day: chicagoTime.getDay(),
    hour: chicagoTime.getHours(),
  };
}

// Helper to get current day of week (adjusted for nightlife - after midnight counts as previous day)
function getCurrentDayOfWeek(): number {
  const { day, hour } = getChicagoTime();
  let adjustedDay = day;

  // If it's between midnight and 5am, consider it still the previous night
  if (hour < 5) {
    adjustedDay = day === 0 ? 6 : day - 1;
  }

  return adjustedDay;
}

/**
 * GET /api/venues
 * Retrieves venues within a bounding box with optional filters
 * Query params: neLat, neLng, swLat, swLng, type (optional), neighborhood (optional),
 *               eventTonight (optional), limit (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const neLat = searchParams.get('neLat');
    const neLng = searchParams.get('neLng');
    const swLat = searchParams.get('swLat');
    const swLng = searchParams.get('swLng');
    const typeParam = searchParams.get('type');
    const neighborhoodParam = searchParams.get('neighborhood');
    const eventTonightParam = searchParams.get('eventTonight');
    const limitParam = searchParams.get('limit');

    // If bounding box not provided, return all venues (useful for initial load)
    let whereClause: any = {};

    if (neLat && neLng && swLat && swLng) {
      const neLat_num = parseFloat(neLat);
      const neLng_num = parseFloat(neLng);
      const swLat_num = parseFloat(swLat);
      const swLng_num = parseFloat(swLng);

      // Validate bounding box coordinates
      if (
        isNaN(neLat_num) ||
        isNaN(neLng_num) ||
        isNaN(swLat_num) ||
        isNaN(swLng_num)
      ) {
        return NextResponse.json(
          { error: 'Invalid bounding box coordinates' },
          { status: 400 }
        );
      }

      // Add geospatial filter
      whereClause = {
        latitude: {
          gte: swLat_num,
          lte: neLat_num,
        },
        longitude: {
          gte: swLng_num,
          lte: neLng_num,
        },
      };
    }

    // Add type filter if provided
    if (typeParam) {
      if (!['bar', 'club', 'latin_dance'].includes(typeParam)) {
        return NextResponse.json(
          { error: 'Invalid venue type. Must be: bar, club, or latin_dance' },
          { status: 400 }
        );
      }
      whereClause.type = typeParam as VenueType;
    }

    // Add neighborhood filter if provided
    if (neighborhoodParam) {
      whereClause.neighborhood = neighborhoodParam;
    }

    // Get current day for event filtering
    const currentDay = getCurrentDayOfWeek();

    // Filter by venues with events tonight if requested
    if (eventTonightParam === 'true' || eventTonightParam === 'latin') {
      whereClause.recurringEvents = {
        some: {
          dayOfWeek: currentDay,
          isActive: true,
          ...(eventTonightParam === 'latin' ? { eventType: 'latin_dance' } : {}),
        },
      };
    }

    // Parse limit (default 100, max 100)
    const limit = limitParam
      ? Math.min(parseInt(limitParam, 10), 100)
      : 100;

    if (isNaN(limit) || limit < 1) {
      return NextResponse.json(
        { error: 'Invalid limit parameter' },
        { status: 400 }
      );
    }

    // Fetch venues from database with recurring events
    const venues = await prisma.venue.findMany({
      where: whereClause,
      take: limit,
      include: {
        recurringEvents: {
          where: {
            dayOfWeek: currentDay,
            isActive: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Get fused busyness data for all venues
    const venueIds = venues.map((v) => v.id);
    const busynessData = await fuseBusynessDataBulk(venueIds);

    // Format response
    const venuesWithBusyness = venues.map((venue) => {
      const busyness = busynessData.get(venue.id) || {
        level: 50,
        confidence: 0,
        trend: 'stable' as const,
        lastUpdated: new Date(),
      };

      // Check for events tonight
      const eventsTonight = venue.recurringEvents || [];
      const hasEventTonight = eventsTonight.length > 0;
      const hasLatinTonight = eventsTonight.some((e) => e.eventType === 'latin_dance');

      return {
        id: venue.id,
        name: venue.name,
        address: venue.address,
        neighborhood: venue.neighborhood,
        latitude: venue.latitude,
        longitude: venue.longitude,
        type: venue.type,
        currentBusyness: {
          level: busyness.level,
          confidence: busyness.confidence,
          trend: busyness.trend,
          lastUpdated: busyness.lastUpdated.toISOString(),
        },
        // Event info
        hasEventTonight,
        hasLatinTonight,
        eventTonight: hasEventTonight ? {
          name: eventsTonight[0].name,
          type: eventsTonight[0].eventType,
          startTime: eventsTonight[0].startTime,
          endTime: eventsTonight[0].endTime,
        } : null,
      };
    });

    return NextResponse.json(
      {
        venues: venuesWithBusyness,
        total: venuesWithBusyness.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in /api/venues:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
