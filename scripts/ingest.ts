#!/usr/bin/env tsx
/**
 * Manual Ingestion Script
 *
 * Triggers the busyness ingestion process locally for testing.
 * This simulates what the Vercel cron job does but runs immediately.
 *
 * Usage:
 *   npx tsx scripts/ingest.ts
 */

import { prisma } from '../src/lib/prisma';
import { getProvider } from '../src/lib/providers';
import { BusynessSource } from '@prisma/client';

async function runIngestion() {
  console.log('🚀 Starting manual busyness ingestion\n');
  const startTime = Date.now();

  let venuesProcessed = 0;
  let observationsCreated = 0;
  let errors = 0;

  try {
    // Fetch all venues
    const venues = await prisma.venue.findMany({
      orderBy: { name: 'asc' },
    });

    console.log(`📍 Found ${venues.length} venues to process\n`);

    if (venues.length === 0) {
      console.log('⚠️  No venues found in database. Run seed script first:');
      console.log('   npx prisma db seed\n');
      process.exit(1);
    }

    // Get the active provider
    const provider = getProvider();
    console.log(`🔌 Using provider: ${provider.name}\n`);

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
            `✓ ${venue.name.padEnd(40)} | Type: ${venue.type.padEnd(12)} | Level: ${reading.level.toString().padStart(3)}/100`
          );
        } else {
          console.log(`⚠ ${venue.name}: no data from provider`);
        }

        venuesProcessed++;
      } catch (error) {
        errors++;
        console.error(`✗ Error processing venue ${venue.name}:`, error);
        // Continue processing other venues even if one fails
      }
    }

    const duration = Date.now() - startTime;

    console.log('\n' + '='.repeat(80));
    console.log('📊 Ingestion Summary:');
    console.log('='.repeat(80));
    console.log(`✓ Venues processed:       ${venuesProcessed}`);
    console.log(`✓ Observations created:   ${observationsCreated}`);
    console.log(`✗ Errors:                 ${errors}`);
    console.log(`⏱  Duration:               ${duration}ms`);
    console.log(`🔌 Provider:              ${provider.name}`);
    console.log('='.repeat(80) + '\n');

    if (observationsCreated > 0) {
      console.log('✅ Ingestion completed successfully!\n');
      console.log('💡 To verify the data, you can:');
      console.log('   1. Check the database: npx prisma studio');
      console.log('   2. Query recent observations:');
      console.log('      npx prisma db query "SELECT * FROM BusynessObservation ORDER BY timestamp DESC LIMIT 10"');
      console.log('   3. Start the dev server and check venue pages: npm run dev\n');
    } else {
      console.log('⚠️  No observations were created. Check for errors above.\n');
    }
  } catch (error) {
    console.error('\n❌ Fatal error during ingestion:', error);
    process.exit(1);
  } finally {
    // Disconnect Prisma client
    await prisma.$disconnect();
  }
}

// Run the script
runIngestion()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
