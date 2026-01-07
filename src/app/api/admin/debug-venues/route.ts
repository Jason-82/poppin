import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/debug-venues
 * Debug endpoint to check venues in database
 */
export async function GET() {
  try {
    // Get all venues
    const allVenues = await prisma.venue.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
        neighborhood: true,
      },
    });

    // Check for Downers Sand Club specifically
    const downers = await prisma.venue.findMany({
      where: {
        name: {
          contains: 'Downer',
          mode: 'insensitive',
        },
      },
    });

    // Get all recurring events
    const events = await prisma.recurringEvent.findMany({
      include: {
        venue: {
          select: { name: true },
        },
      },
    });

    return NextResponse.json({
      totalVenues: allVenues.length,
      venues: allVenues,
      downersSearch: downers,
      recurringEvents: events.map((e) => ({
        venue: e.venue.name,
        eventType: e.eventType,
        dayOfWeek: e.dayOfWeek,
        name: e.name,
      })),
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
