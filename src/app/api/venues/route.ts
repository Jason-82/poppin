import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fuseBusynessDataBulk } from '@/lib/busyness';
import { VenueType } from '@prisma/client';

/**
 * GET /api/venues
 * Retrieves venues within a bounding box with optional filters
 * Query params: neLat, neLng, swLat, swLng, type (optional), limit (optional)
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

    // Fetch venues from database
    const venues = await prisma.venue.findMany({
      where: whereClause,
      take: limit,
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

      return {
        id: venue.id,
        name: venue.name,
        address: venue.address,
        latitude: venue.latitude,
        longitude: venue.longitude,
        type: venue.type,
        currentBusyness: {
          level: busyness.level,
          confidence: busyness.confidence,
          trend: busyness.trend,
          lastUpdated: busyness.lastUpdated.toISOString(),
        },
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
