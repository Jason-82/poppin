import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fuseBusynessData } from '@/lib/busyness';

/**
 * GET /api/venues/[id]
 * Retrieves detailed information for a specific venue
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Fetch venue with recent crowd reports
    const venue = await prisma.venue.findUnique({
      where: { id },
      include: {
        crowdReports: {
          orderBy: { createdAt: 'desc' },
          take: 5, // Last 5 reports
          select: {
            level: true,
            tags: true,
            createdAt: true,
          },
        },
      },
    });

    if (!venue) {
      return NextResponse.json(
        { error: 'Venue not found' },
        { status: 404 }
      );
    }

    // Get fused busyness data
    const busyness = await fuseBusynessData(id);

    // Format recent reports with time ago
    const recentReports = venue.crowdReports.map((report) => ({
      level: report.level,
      tags: report.tags,
      createdAt: report.createdAt.toISOString(),
      timeAgo: getTimeAgo(report.createdAt),
    }));

    // Format response
    const response = {
      id: venue.id,
      name: venue.name,
      address: venue.address,
      latitude: venue.latitude,
      longitude: venue.longitude,
      type: venue.type,
      description: venue.description,
      phoneNumber: venue.phoneNumber,
      website: venue.website,
      currentBusyness: {
        level: busyness.level,
        confidence: busyness.confidence,
        trend: busyness.trend,
        lastUpdated: busyness.lastUpdated.toISOString(),
      },
      recentReports,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error in /api/venues/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to format time ago string
 */
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}
