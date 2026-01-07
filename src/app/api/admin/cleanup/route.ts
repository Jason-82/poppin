/**
 * Admin Cleanup Endpoint
 *
 * Removes duplicate venues and adds back manually curated venues.
 * Protected by CRON_SECRET for security.
 *
 * Usage: POST /api/admin/cleanup with Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Manually curated venues that should always exist
const CURATED_VENUES = [
  {
    name: 'Downers Sand Club Sports Bar & Grill',
    address: '4850 Main St, Downers Grove, IL 60515',
    neighborhood: 'Downers Grove',
    latitude: 41.7948,
    longitude: -88.0169,
    type: 'latin_dance' as const,
    description: 'Sports bar with West Coast Swing dancing nights',
  },
];

/**
 * Normalize venue name for comparison
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove non-alphanumeric
    .replace(/nightclub|club|bar|restaurant|lounge|chicago|the/g, '') // Remove common suffixes
    .trim();
}

/**
 * Check if two names are similar enough to be duplicates
 */
function areSimilarNames(name1: string, name2: string): boolean {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);

  // Exact match after normalization
  if (n1 === n2) return true;

  // One contains the other
  if (n1.includes(n2) || n2.includes(n1)) return true;

  // Check if they share a significant common prefix (at least 5 chars)
  const minLen = Math.min(n1.length, n2.length);
  if (minLen >= 5) {
    let commonPrefix = 0;
    for (let i = 0; i < minLen; i++) {
      if (n1[i] === n2[i]) commonPrefix++;
      else break;
    }
    if (commonPrefix >= 5 && commonPrefix >= minLen * 0.7) return true;
  }

  return false;
}

export async function POST(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[ADMIN] Starting cleanup...');

    // Get all venues
    const allVenues = await prisma.venue.findMany({
      orderBy: { name: 'asc' },
    });

    console.log(`[ADMIN] Found ${allVenues.length} total venues`);

    // Find duplicates
    const duplicatesToDelete: string[] = [];
    const seen = new Map<string, { id: string; name: string }>();

    for (const venue of allVenues) {
      const normalized = normalizeName(venue.name);

      // Check if we've seen a similar venue
      let isDuplicate = false;
      for (const [seenNorm, seenVenue] of seen) {
        if (areSimilarNames(venue.name, seenVenue.name)) {
          // Keep the one with shorter name (usually the cleaner one)
          if (venue.name.length > seenVenue.name.length) {
            duplicatesToDelete.push(venue.id);
            console.log(`[ADMIN] Duplicate: "${venue.name}" (keeping "${seenVenue.name}")`);
          } else {
            duplicatesToDelete.push(seenVenue.id);
            seen.delete(seenNorm);
            seen.set(normalized, { id: venue.id, name: venue.name });
            console.log(`[ADMIN] Duplicate: "${seenVenue.name}" (keeping "${venue.name}")`);
          }
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        seen.set(normalized, { id: venue.id, name: venue.name });
      }
    }

    // Delete duplicates
    if (duplicatesToDelete.length > 0) {
      // First delete related records
      await prisma.crowdReport.deleteMany({
        where: { venueId: { in: duplicatesToDelete } },
      });
      await prisma.busynessObservation.deleteMany({
        where: { venueId: { in: duplicatesToDelete } },
      });
      await prisma.venueVideo.deleteMany({
        where: { venueId: { in: duplicatesToDelete } },
      });

      // Then delete venues
      await prisma.venue.deleteMany({
        where: { id: { in: duplicatesToDelete } },
      });

      console.log(`[ADMIN] Deleted ${duplicatesToDelete.length} duplicate venues`);
    }

    // Add curated venues if missing
    let curatedAdded = 0;
    for (const curatedVenue of CURATED_VENUES) {
      const exists = await prisma.venue.findFirst({
        where: {
          OR: [
            { name: curatedVenue.name },
            {
              AND: [
                { latitude: curatedVenue.latitude },
                { longitude: curatedVenue.longitude },
              ]
            },
          ],
        },
      });

      if (!exists) {
        await prisma.venue.create({
          data: curatedVenue,
        });
        curatedAdded++;
        console.log(`[ADMIN] Added curated venue: ${curatedVenue.name}`);
      }
    }

    // Get final count
    const finalCount = await prisma.venue.count();

    return NextResponse.json({
      success: true,
      duplicatesRemoved: duplicatesToDelete.length,
      curatedVenuesAdded: curatedAdded,
      totalVenues: finalCount,
    });
  } catch (error) {
    console.error('[ADMIN] Error during cleanup:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint to preview duplicates without deleting
export async function GET(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const allVenues = await prisma.venue.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, address: true, type: true },
    });

    // Find potential duplicates
    const duplicateGroups: Array<{ keep: string; remove: string }> = [];
    const seen = new Map<string, { id: string; name: string }>();

    for (const venue of allVenues) {
      for (const [, seenVenue] of seen) {
        if (areSimilarNames(venue.name, seenVenue.name)) {
          if (venue.name.length > seenVenue.name.length) {
            duplicateGroups.push({ keep: seenVenue.name, remove: venue.name });
          } else {
            duplicateGroups.push({ keep: venue.name, remove: seenVenue.name });
          }
          break;
        }
      }
      seen.set(normalizeName(venue.name), { id: venue.id, name: venue.name });
    }

    return NextResponse.json({
      totalVenues: allVenues.length,
      potentialDuplicates: duplicateGroups,
      duplicateCount: duplicateGroups.length,
    });
  } catch (error) {
    console.error('[ADMIN] Error:', error);
    return NextResponse.json({ error: 'Failed to check duplicates' }, { status: 500 });
  }
}
