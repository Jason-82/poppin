/**
 * Admin Import Venues Endpoint
 *
 * Imports venues from Google Places API for Chicago.
 * Protected by CRON_SECRET for security.
 *
 * Usage: POST /api/admin/import-venues with Authorization: Bearer <CRON_SECRET>
 *
 * Query params:
 *   - mode: 'preview' (default) or 'import'
 *   - replace: 'true' to replace all existing venues, 'false' to merge (default)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { importChicagoVenues, ImportedVenue } from '@/lib/google-places';

export async function POST(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check for Google Places API key
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GOOGLE_PLACES_API_KEY environment variable not set' },
      { status: 500 }
    );
  }

  // Parse query params
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'preview';
  const replace = searchParams.get('replace') === 'true';

  try {
    console.log(`[ADMIN] Starting venue import (mode: ${mode}, replace: ${replace})`);

    // Import venues from Google Places
    const { venues, errors, stats } = await importChicagoVenues(apiKey);

    if (mode === 'preview') {
      // Preview mode - just return what would be imported
      return NextResponse.json({
        mode: 'preview',
        message: 'Preview of venues that would be imported. Use mode=import to actually import.',
        stats,
        errors: errors.length > 0 ? errors : undefined,
        venues: venues.map(v => ({
          name: v.name,
          type: v.type,
          neighborhood: v.neighborhood,
          address: v.address,
        })),
      });
    }

    // Import mode - actually save to database
    let created = 0;
    let updated = 0;
    let skipped = 0;

    if (replace) {
      // Delete all existing venues first
      console.log('[ADMIN] Replacing all existing venues...');
      await prisma.crowdReport.deleteMany({});
      await prisma.busynessObservation.deleteMany({});
      await prisma.venueVideo.deleteMany({});
      await prisma.venue.deleteMany({});
    }

    // Import each venue
    for (const venue of venues) {
      try {
        // Check if venue already exists by googlePlaceId
        const existing = await prisma.venue.findFirst({
          where: {
            OR: [
              { googlePlaceId: venue.googlePlaceId },
              {
                AND: [
                  { name: venue.name },
                  { address: venue.address },
                ],
              },
            ],
          },
        });

        if (existing) {
          if (replace) {
            // This shouldn't happen since we deleted all, but just in case
            skipped++;
          } else {
            // Update existing venue with new data
            await prisma.venue.update({
              where: { id: existing.id },
              data: {
                googlePlaceId: venue.googlePlaceId,
                neighborhood: venue.neighborhood,
                website: venue.website || existing.website,
                phoneNumber: venue.phoneNumber || existing.phoneNumber,
              },
            });
            updated++;
          }
        } else {
          // Create new venue
          await prisma.venue.create({
            data: {
              name: venue.name,
              address: venue.address,
              neighborhood: venue.neighborhood,
              latitude: venue.latitude,
              longitude: venue.longitude,
              type: venue.type,
              googlePlaceId: venue.googlePlaceId,
              website: venue.website,
              phoneNumber: venue.phoneNumber,
            },
          });
          created++;
        }
      } catch (venueError) {
        console.error(`[ADMIN] Error importing venue "${venue.name}":`, venueError);
        skipped++;
      }
    }

    console.log(`[ADMIN] Import complete: ${created} created, ${updated} updated, ${skipped} skipped`);

    return NextResponse.json({
      mode: 'import',
      success: true,
      stats: {
        ...stats,
        created,
        updated,
        skipped,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[ADMIN] Error during import:', error);
    return NextResponse.json(
      { error: 'Failed to import venues', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Also support GET for checking status
export async function GET(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hasApiKey = !!process.env.GOOGLE_PLACES_API_KEY;
  const venueCount = await prisma.venue.count();

  return NextResponse.json({
    status: 'ready',
    googlePlacesConfigured: hasApiKey,
    currentVenueCount: venueCount,
    usage: {
      preview: 'POST /api/admin/import-venues?mode=preview',
      import: 'POST /api/admin/import-venues?mode=import',
      replaceAll: 'POST /api/admin/import-venues?mode=import&replace=true',
    },
  });
}
