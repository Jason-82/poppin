import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { getBrowserToken } from '@/lib/auth';
import { authOptions } from '@/lib/auth-options';
import { checkReportRateLimit, getClientIP, hashIP } from '@/lib/rateLimit';
import { crowdLevelToNumeric } from '@/lib/busyness';
import { awardPoints, POINTS } from '@/lib/gamification';
import { CrowdLevel } from '@prisma/client';

const VALID_CROWD_LEVELS: CrowdLevel[] = ['dead', 'warm', 'busy', 'packed'];

const VALID_TAGS = [
  'good_music',
  'long_wait',
  'great_crowd',
  'expensive',
  'friendly_staff',
  'good_vibes',
  'too_crowded',
  'slow_service',
  'great_drinks',
  'good_for_dancing',
];

/**
 * POST /api/venues/[id]/report
 * Submit a crowdsourced busyness report for a venue
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: venueId } = await context.params;

    // Verify venue exists
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
    });

    if (!venue) {
      return NextResponse.json(
        { error: 'Venue not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { level, tags } = body;

    // Validate level
    if (!level || !VALID_CROWD_LEVELS.includes(level)) {
      return NextResponse.json(
        {
          error: `Invalid level. Must be one of: ${VALID_CROWD_LEVELS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validate tags (optional)
    let validatedTags: string[] = [];
    if (tags) {
      if (!Array.isArray(tags)) {
        return NextResponse.json(
          { error: 'Tags must be an array' },
          { status: 400 }
        );
      }

      // Filter and validate tags
      validatedTags = tags.filter((tag) => {
        if (typeof tag !== 'string') return false;
        return VALID_TAGS.includes(tag);
      });

      // Limit to max 5 tags
      validatedTags = validatedTags.slice(0, 5);
    }

    // Get client IP and browser token
    const ipAddress = getClientIP(request);
    const browserToken = await getBrowserToken();

    // Check rate limits (using plain IP for rate limiting)
    const rateLimitResult = checkReportRateLimit(ipAddress, browserToken);

    if (!rateLimitResult.allowed) {
      const resetTime = rateLimitResult.resetAt
        ? new Date(rateLimitResult.resetAt).toISOString()
        : 'soon';

      return NextResponse.json(
        {
          error: `Rate limit exceeded. ${rateLimitResult.reason}. Try again at ${resetTime}`,
        },
        { status: 429 }
      );
    }

    // Get user agent
    const userAgent = request.headers.get('user-agent') || undefined;

    // Hash IP address for privacy-preserving storage
    const hashedIP = hashIP(ipAddress);

    // Check if user is authenticated
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;

    // Create crowd report
    const report = await prisma.crowdReport.create({
      data: {
        venueId,
        level: level as CrowdLevel,
        tags: validatedTags,
        browserToken,
        ipAddress: hashedIP, // Store hashed IP, not plain text
        userAgent,
        userId, // Link to authenticated user if available
      },
    });

    // Convert level to numeric and create busyness observation
    const numericLevel = crowdLevelToNumeric(level as CrowdLevel);

    await prisma.busynessObservation.create({
      data: {
        venueId,
        source: 'crowd',
        level: numericLevel,
      },
    });

    // Award points if user is authenticated
    let pointsResult = null;
    if (userId) {
      try {
        pointsResult = await awardPoints(userId, POINTS.REPORT_SUBMITTED, 'report');
      } catch (err) {
        console.error('Error awarding points:', err);
        // Don't fail the request if points fail
      }
    }

    return NextResponse.json(
      {
        success: true,
        reportId: report.id,
        message: 'Report submitted successfully',
        ...(pointsResult && {
          points: {
            awarded: pointsResult.pointsAwarded,
            total: pointsResult.totalPoints,
            newBadges: pointsResult.newBadges,
          },
        }),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in /api/venues/[id]/report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
