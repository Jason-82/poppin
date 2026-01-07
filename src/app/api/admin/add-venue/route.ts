/**
 * Admin Add Venue Endpoint
 *
 * Directly adds a specific venue to the database.
 * Protected by CRON_SECRET for security.
 *
 * Usage: POST /api/admin/add-venue with Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { VenueType } from '@prisma/client';

// Venues to force-add (bypasses duplicate checks)
const FORCE_ADD_VENUES = [
  {
    name: 'Downers Sand Club',
    address: '4850 Main St, Downers Grove, IL 60515',
    neighborhood: 'Downers Grove',
    latitude: 41.7948,
    longitude: -88.0169,
    type: 'latin_dance' as VenueType,
    description: 'Sports bar with West Coast Swing dancing nights',
  },
];

export async function POST(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results: string[] = [];

    for (const venue of FORCE_ADD_VENUES) {
      // Check if exact name already exists
      const existing = await prisma.venue.findFirst({
        where: { name: venue.name },
      });

      if (existing) {
        results.push(`${venue.name}: already exists (id: ${existing.id})`);
      } else {
        const created = await prisma.venue.create({
          data: venue,
        });
        results.push(`${venue.name}: created (id: ${created.id})`);
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('[ADMIN] Error adding venue:', error);
    return NextResponse.json(
      { error: 'Failed to add venue', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
