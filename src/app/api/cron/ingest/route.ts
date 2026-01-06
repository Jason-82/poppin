/**
 * Cron Ingestion Endpoint
 *
 * Fetches current busyness data from the provider for all venues
 * and stores it in the database as BusynessObservation records.
 *
 * This endpoint is called by Vercel Cron every 15 minutes.
 * It's secured with a CRON_SECRET header to prevent unauthorized access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getProvider } from '@/lib/providers';
import { BusynessSource } from '@prisma/client';

/**
 * GET /api/cron/ingest
 *
 * Verifies CRON_SECRET, fetches all venues, gets busyness from provider,
 * and creates BusynessObservation records.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Verify authorization header contains the CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expectedAuth) {
    console.error('Unauthorized cron request:', {
      hasHeader: !!authHeader,
      headerMatches: authHeader === expectedAuth,
    });

    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  console.log('[CRON] Starting busyness ingestion job');

  let venuesProcessed = 0;
  let observationsCreated = 0;
  let errors = 0;

  try {
    // Fetch all active venues from database
    const venues = await prisma.venue.findMany({
      orderBy: { name: 'asc' },
    });

    console.log(`[CRON] Found ${venues.length} venues to process`);

    // Get the active provider
    const provider = getProvider();
    console.log(`[CRON] Using provider: ${provider.name}`);

    // Process each venue
    for (const venue of venues) {
      try {
        // Get current busyness from provider
        const reading = await provider.getBusynessNow(venue);

        if (reading) {
          // Create BusynessObservation record
          await prisma.busynessObservation.create({
            data: {
              venueId: venue.id,
              source: BusynessSource.provider,
              level: reading.level,
              timestamp: reading.timestamp,
            },
          });

          observationsCreated++;
          console.log(
            `[CRON] ✓ ${venue.name}: level=${reading.level}`
          );
        } else {
          console.log(`[CRON] ⚠ ${venue.name}: no data from provider`);
        }

        venuesProcessed++;
      } catch (error) {
        errors++;
        console.error(`[CRON] ✗ Error processing venue ${venue.name}:`, error);
        // Continue processing other venues even if one fails
      }
    }

    const duration = Date.now() - startTime;

    const summary = {
      success: true,
      venuesProcessed,
      observationsCreated,
      errors,
      duration,
      provider: provider.name,
    };

    console.log('[CRON] Ingestion job completed:', summary);

    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    const duration = Date.now() - startTime;

    console.error('[CRON] Fatal error during ingestion:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        venuesProcessed,
        observationsCreated,
        errors: errors + 1,
        duration,
      },
      { status: 500 }
    );
  }
}
