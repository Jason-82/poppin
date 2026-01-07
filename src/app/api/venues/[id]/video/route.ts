import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBrowserToken } from '@/lib/auth';
import { getClientIP, hashIP, rateLimitByIP, rateLimitByToken } from '@/lib/rateLimit';

/**
 * Calculate distance between two GPS coordinates in meters using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * POST /api/venues/[id]/video
 * Upload a video for a venue
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

    // Get browser token and IP
    const browserToken = await getBrowserToken();
    const ipAddress = getClientIP(request);

    // Rate limiting: 3 video uploads per hour per IP, 5 per hour per token
    const ipResult = rateLimitByIP(ipAddress, {
      maxRequests: 3,
      windowMs: 60 * 60 * 1000,
    });

    if (!ipResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. You can upload 3 videos per hour.',
          resetAt: new Date(ipResult.resetAt).toISOString(),
        },
        { status: 429 }
      );
    }

    const tokenResult = rateLimitByToken(browserToken, {
      maxRequests: 5,
      windowMs: 60 * 60 * 1000,
    });

    if (!tokenResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. You can upload 5 videos per hour.',
          resetAt: new Date(tokenResult.resetAt).toISOString(),
        },
        { status: 429 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const videoFile = formData.get('video') as File | null;
    const latitude = formData.get('latitude')
      ? parseFloat(formData.get('latitude') as string)
      : null;
    const longitude = formData.get('longitude')
      ? parseFloat(formData.get('longitude') as string)
      : null;

    if (!videoFile) {
      return NextResponse.json(
        { error: 'No video file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!videoFile.type.startsWith('video/')) {
      return NextResponse.json(
        { error: 'File must be a video' },
        { status: 400 }
      );
    }

    // Validate file size (max 50MB)
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB in bytes
    if (videoFile.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Video file too large. Maximum size is 50MB' },
        { status: 400 }
      );
    }

    // GPS verification (optional but encouraged)
    if (latitude !== null && longitude !== null) {
      const distance = calculateDistance(
        venue.latitude,
        venue.longitude,
        latitude,
        longitude
      );

      // If user is more than 500m away, reject
      if (distance > 500) {
        return NextResponse.json(
          {
            error: 'You must be within 500 meters of the venue to upload a video',
            distance: Math.round(distance),
          },
          { status: 403 }
        );
      }
    }

    // Convert video to base64 for MVP (not ideal for production)
    const arrayBuffer = await videoFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Video = buffer.toString('base64');
    const videoUrl = `data:${videoFile.type};base64,${base64Video}`;

    // Set expiration time (4 hours from now)
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);

    // Create video record
    const video = await prisma.venueVideo.create({
      data: {
        venueId,
        videoUrl,
        browserToken,
        latitude,
        longitude,
        expiresAt,
      },
    });

    return NextResponse.json(
      {
        success: true,
        videoId: video.id,
        expiresAt: video.expiresAt.toISOString(),
        message: 'Video uploaded successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/venues/[id]/video:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/venues/[id]/video
 * Get active (non-expired) videos for a venue
 */
export async function GET(
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

    // Get active videos (not expired)
    const now = new Date();
    const videos = await prisma.venueVideo.findMany({
      where: {
        venueId,
        expiresAt: {
          gt: now,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        videoUrl: true,
        thumbnailUrl: true,
        createdAt: true,
        expiresAt: true,
        latitude: true,
        longitude: true,
      },
    });

    return NextResponse.json({
      videos,
      count: videos.length,
    });
  } catch (error) {
    console.error('Error in GET /api/venues/[id]/video:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/venues/[id]/video
 * Delete a video (only by the uploader)
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: venueId } = await context.params;

    // Parse request body
    const body = await request.json();
    const { videoId } = body;

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }

    // Get browser token
    const browserToken = await getBrowserToken();

    // Find video
    const video = await prisma.venueVideo.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (video.browserToken !== browserToken) {
      return NextResponse.json(
        { error: 'You can only delete your own videos' },
        { status: 403 }
      );
    }

    // Verify venue match
    if (video.venueId !== venueId) {
      return NextResponse.json(
        { error: 'Video does not belong to this venue' },
        { status: 400 }
      );
    }

    // Delete video
    await prisma.venueVideo.delete({
      where: { id: videoId },
    });

    return NextResponse.json({
      success: true,
      message: 'Video deleted successfully',
    });
  } catch (error) {
    console.error('Error in DELETE /api/venues/[id]/video:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
