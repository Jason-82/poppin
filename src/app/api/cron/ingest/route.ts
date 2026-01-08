/**
 * Cron Ingestion Endpoint
 *
 * Fetches current busyness data from the provider for venues in batches.
 * Each run processes ~50 venues to stay within Vercel's timeout limits.
 *
 * With 8 batches running every 5 minutes, all venues are updated every 40 minutes.
 * It's secured with a CRON_SECRET header to prevent unauthorized access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getProvider } from '@/lib/providers';
import { BusynessSource } from '@prisma/client';

// Batch configuration
const VENUES_PER_BATCH = 50;
const TOTAL_BATCHES = 8;

/**
 * GET /api/cron/ingest
 *
 * Verifies CRON_SECRET, fetches a batch of venues, gets busyness from provider,
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

  // Determine which batch to process based on current time
  // Each 5-minute interval processes a different batch
  const now = new Date();
  const minuteOfDay = now.getHours() * 60 + now.getMinutes();
  const batchIndex = Math.floor(minuteOfDay / 5) % TOTAL_BATCHES;

  console.log(`[CRON] Starting busyness ingestion job - Batch ${batchIndex + 1}/${TOTAL_BATCHES}`);

  let venuesProcessed = 0;
  let observationsCreated = 0;
  let errors = 0;

  try {
    // Fetch all active venues from database
    const allVenues = await prisma.venue.findMany({
      orderBy: { name: 'asc' },
    });

    // Select venues for this batch using modulo
    const venues = allVenues.filter((_, index) => index % TOTAL_BATCHES === batchIndex);

    console.log(`[CRON] Processing ${venues.length} venues (batch ${batchIndex + 1} of ${TOTAL_BATCHES}, total: ${allVenues.length})`);

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
          // level = -1 means venue is closed
          await prisma.busynessObservation.create({
            data: {
              venueId: venue.id,
              source: BusynessSource.provider,
              level: reading.level,
              timestamp: reading.timestamp,
            },
          });

          observationsCreated++;

          if (reading.level === -1) {
            console.log(
              `[CRON] ✓ ${venue.name}: CLOSED${reading.expectedWhenOpen ? ` (expected ${reading.expectedWhenOpen}% when open)` : ''}`
            );
          } else {
            console.log(
              `[CRON] ✓ ${venue.name}: level=${reading.level}`
            );
          }
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
      batch: batchIndex + 1,
      totalBatches: TOTAL_BATCHES,
      venuesProcessed,
      observationsCreated,
      errors,
      duration,
      provider: provider.name,
    };

    console.log(`[CRON] Batch ${batchIndex + 1}/${TOTAL_BATCHES} completed:`, summary);

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
