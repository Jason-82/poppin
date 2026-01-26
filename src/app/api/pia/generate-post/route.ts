/**
 * POST /api/pia/generate-post
 *
 * Generate Instagram post content for Pia
 * Can be called manually or via cron
 *
 * Query params:
 * - type: 'post' (feed post) or 'story' (story update)
 * - neighborhood: Optional specific neighborhood for story
 * - publish: If 'true', actually publish to Instagram (requires META_PAGE_ACCESS_TOKEN)
 *
 * Returns generated content that can be posted to Instagram
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateWeekendPost,
  generateStoryUpdate,
  getTopVenues,
  CHICAGO_NEIGHBORHOODS,
} from '@/lib/pia';

const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  // Verify cron secret if provided
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type') || 'post';
  const neighborhood = searchParams.get('neighborhood');
  const shouldPublish = searchParams.get('publish') === 'true';

  try {
    if (type === 'story') {
      // Generate story update
      const story = await generateStoryUpdate(neighborhood || undefined);

      return NextResponse.json({
        type: 'story',
        content: story,
        neighborhood: neighborhood || 'city-wide',
        generatedAt: new Date().toISOString(),
      });
    }

    // Generate full post
    const post = await generateWeekendPost();

    // Build the full post content
    const venueList = post.topVenues
      .slice(0, 3)
      .map((v, i) => {
        const emoji = i === 0 ? '🔥' : i === 1 ? '🔥' : '✨';
        const status = v.busyness.level > 75 ? 'packed' :
                       v.busyness.level > 50 ? 'busy' :
                       v.busyness.level > 25 ? 'warming up' : 'chill';
        return `${emoji} ${v.name} - ${status}`;
      })
      .join('\n');

    const fullCaption = `${post.caption}\n\n${venueList}\n\n📍 Live updates: poppin.app\n\n#ChicagoNightlife #Chicago #WhereToGo #NightOut`;

    const response = {
      type: 'post',
      caption: fullCaption,
      shortCaption: post.caption,
      topVenues: post.topVenues,
      generatedAt: new Date().toISOString(),
    };

    // Optionally publish to Instagram
    if (shouldPublish && PAGE_ACCESS_TOKEN && INSTAGRAM_ACCOUNT_ID) {
      const published = await publishToInstagram(fullCaption);
      return NextResponse.json({ ...response, published });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error generating post:', error);
    return NextResponse.json(
      { error: 'Failed to generate post' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type = 'post', neighborhood, publish = false } = body;

    if (type === 'story') {
      const story = await generateStoryUpdate(neighborhood);
      return NextResponse.json({
        type: 'story',
        content: story,
        neighborhood: neighborhood || 'city-wide',
      });
    }

    const post = await generateWeekendPost();

    const venueList = post.topVenues
      .slice(0, 3)
      .map((v, i) => {
        const emoji = i === 0 ? '🔥' : i === 1 ? '🔥' : '✨';
        const status = v.busyness.level > 75 ? 'packed' :
                       v.busyness.level > 50 ? 'busy' :
                       v.busyness.level > 25 ? 'warming up' : 'chill';
        return `${emoji} ${v.name} - ${status}`;
      })
      .join('\n');

    const fullCaption = `${post.caption}\n\n${venueList}\n\n📍 Live updates: poppin.app\n\n#ChicagoNightlife #Chicago #WhereToGo #NightOut`;

    return NextResponse.json({
      type: 'post',
      caption: fullCaption,
      shortCaption: post.caption,
      topVenues: post.topVenues,
    });
  } catch (error) {
    console.error('Error generating post:', error);
    return NextResponse.json(
      { error: 'Failed to generate post' },
      { status: 500 }
    );
  }
}

/**
 * Publish a text post to Instagram
 * Note: Instagram Graph API requires a media URL for posts
 * This is a placeholder - you'd need to generate/host an image
 */
async function publishToInstagram(caption: string): Promise<{ success: boolean; error?: string }> {
  if (!PAGE_ACCESS_TOKEN || !INSTAGRAM_ACCOUNT_ID) {
    return { success: false, error: 'Instagram credentials not configured' };
  }

  // Instagram requires an image for feed posts
  // For now, just return the caption for manual posting
  // In production, you'd:
  // 1. Generate an image (using venue photos or AI-generated)
  // 2. Upload to a public URL
  // 3. Create media container via API
  // 4. Publish the container

  console.log('Instagram publish requested - manual posting required');
  console.log('Caption:', caption);

  return {
    success: false,
    error: 'Auto-publish not implemented - use caption for manual posting',
  };
}
