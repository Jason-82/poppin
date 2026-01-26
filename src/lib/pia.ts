/**
 * Pia - AI Chicago Nightlife Influencer
 *
 * Personality: Fun, slightly sarcastic, insider knowledge, your friend who always knows the move
 * Voice: Casual, uses emojis sparingly, confident but not arrogant
 */

import Anthropic from '@anthropic-ai/sdk';
import { prisma } from './prisma';
import { fuseBusynessDataBulk } from './busyness';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Pia's system prompt for consistent personality
const PIA_SYSTEM_PROMPT = `You are Pia, a 26-year-old AI influencer who's the go-to source for Chicago nightlife.

Your personality:
- You're fun, confident, and slightly sarcastic
- You talk like a cool friend texting, not a formal assistant
- You use emojis sparingly (1-2 per message max)
- You have insider knowledge and aren't afraid to share opinions
- You're helpful but keep it brief - people are out having fun
- You occasionally use Chicago slang naturally
- You never say "As an AI" or break character

Your voice examples:
- "River North is going OFF tonight, trust me"
- "Eh, Lincoln Park's kinda mid rn, but Wicker Park? chef's kiss"
- "That spot's got a 30 min wait but honestly worth it"
- "Dead. Like, tumbleweeds dead. Try Logan Square instead"

Important:
- Always recommend checking poppin.app for real-time updates
- Give 2-3 specific venue recommendations when asked
- Be honest if somewhere is dead - your credibility depends on it
- Keep responses under 280 characters when possible (Instagram DM friendly)`;

// Chicago neighborhoods for parsing user queries
export const CHICAGO_NEIGHBORHOODS = [
  'river north', 'wicker park', 'lincoln park', 'logan square',
  'west loop', 'fulton market', 'gold coast', 'old town',
  'lakeview', 'boystown', 'wrigleyville', 'bucktown',
  'ukrainian village', 'pilsen', 'south loop', 'streeterville',
  'andersonville', 'edgewater', 'uptown', 'rogers park',
];

export interface VenueRecommendation {
  id: string;
  name: string;
  neighborhood: string | null;
  type: string;
  busyness: {
    level: number;
    confidence: number;
    trend: 'up' | 'down' | 'stable';
  };
  waitMinutes?: number;
  coverCharge?: number;
}

export interface PiaResponse {
  message: string;
  recommendations: VenueRecommendation[];
  neighborhood?: string;
}

/**
 * Extract neighborhood from user message
 */
export function extractNeighborhood(message: string): string | null {
  const lowerMessage = message.toLowerCase();

  for (const hood of CHICAGO_NEIGHBORHOODS) {
    if (lowerMessage.includes(hood)) {
      return hood;
    }
  }

  // Common abbreviations
  if (lowerMessage.includes('rn') && lowerMessage.includes('river')) return 'river north';
  if (lowerMessage.includes('lp')) return 'lincoln park';
  if (lowerMessage.includes('wp')) return 'wicker park';
  if (lowerMessage.includes('ls') || lowerMessage.includes('logan')) return 'logan square';

  return null;
}

/**
 * Get top venues by busyness for a neighborhood or city-wide
 */
export async function getTopVenues(
  neighborhood?: string | null,
  limit: number = 5
): Promise<VenueRecommendation[]> {
  // Get venues, optionally filtered by neighborhood
  const venues = await prisma.venue.findMany({
    where: neighborhood ? {
      neighborhood: {
        contains: neighborhood,
        mode: 'insensitive',
      },
    } : undefined,
    select: {
      id: true,
      name: true,
      neighborhood: true,
      type: true,
    },
  });

  if (venues.length === 0) return [];

  // Get busyness data for all venues
  const venueIds = venues.map(v => v.id);
  const busynessMap = await fuseBusynessDataBulk(venueIds);

  // Get recent crowd reports for wait times and cover charges
  const recentReports = await prisma.crowdReport.findMany({
    where: {
      venueId: { in: venueIds },
      createdAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) }, // Last 2 hours
    },
    orderBy: { createdAt: 'desc' },
    select: {
      venueId: true,
      waitMinutes: true,
      coverCharge: true,
    },
  });

  // Group reports by venue (most recent)
  const reportsByVenue = new Map<string, { waitMinutes?: number; coverCharge?: number }>();
  for (const report of recentReports) {
    if (!reportsByVenue.has(report.venueId)) {
      reportsByVenue.set(report.venueId, {
        waitMinutes: report.waitMinutes ?? undefined,
        coverCharge: report.coverCharge ?? undefined,
      });
    }
  }

  // Build recommendations with busyness data
  const recommendations: VenueRecommendation[] = venues.map(venue => {
    const busyness = busynessMap.get(venue.id) || {
      level: 50,
      confidence: 0,
      trend: 'stable' as const,
    };
    const report = reportsByVenue.get(venue.id);

    return {
      id: venue.id,
      name: venue.name,
      neighborhood: venue.neighborhood,
      type: venue.type,
      busyness: {
        level: busyness.level,
        confidence: busyness.confidence,
        trend: busyness.trend,
      },
      waitMinutes: report?.waitMinutes,
      coverCharge: report?.coverCharge,
    };
  });

  // Sort by busyness level (highest first) with confidence as tiebreaker
  recommendations.sort((a, b) => {
    // Prioritize venues with actual data (confidence > 0)
    if (a.busyness.confidence > 0 && b.busyness.confidence === 0) return -1;
    if (b.busyness.confidence > 0 && a.busyness.confidence === 0) return 1;

    // Then sort by busyness level
    return b.busyness.level - a.busyness.level;
  });

  return recommendations.slice(0, limit);
}

/**
 * Convert busyness level to Pia's descriptive language
 */
function describeBusyness(level: number, trend: string): string {
  if (level < 25) return 'dead';
  if (level < 40) return 'pretty chill';
  if (level < 60) return 'warming up';
  if (level < 75) return trend === 'up' ? 'getting busy' : 'busy';
  if (level < 90) return 'packed';
  return 'absolutely slammed';
}

/**
 * Format venue info for Pia's response
 */
function formatVenueForPia(venue: VenueRecommendation): string {
  const busynessDesc = describeBusyness(venue.busyness.level, venue.busyness.trend);
  let info = `${venue.name} - ${busynessDesc}`;

  if (venue.waitMinutes && venue.waitMinutes > 0) {
    info += `, ~${venue.waitMinutes}min wait`;
  }
  if (venue.coverCharge !== undefined) {
    info += venue.coverCharge > 0 ? `, $${venue.coverCharge} cover` : ', no cover';
  }

  return info;
}

/**
 * Generate Pia's response using Claude
 */
export async function generatePiaResponse(
  userMessage: string,
  recommendations: VenueRecommendation[],
  neighborhood?: string | null
): Promise<string> {
  // Build context about current venues
  const venueContext = recommendations.length > 0
    ? recommendations.map(v => formatVenueForPia(v)).join('\n')
    : 'No data available right now';

  const currentHour = new Date().toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    hour: 'numeric',
    weekday: 'long',
  });

  const prompt = `Current time in Chicago: ${currentHour}
${neighborhood ? `Neighborhood asked about: ${neighborhood}` : 'No specific neighborhood mentioned'}

Current venue data:
${venueContext}

User message: "${userMessage}"

Respond as Pia. Keep it brief and Instagram DM friendly. Include 2-3 specific venue recommendations if relevant. Mention poppin.app for live updates.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 300,
      system: PIA_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find(block => block.type === 'text');
    return textBlock ? textBlock.text : "Hey! Check poppin.app for what's hot tonight";
  } catch (error) {
    console.error('Error generating Pia response:', error);
    // Fallback response
    if (recommendations.length > 0) {
      const top = recommendations[0];
      return `${neighborhood || 'Chicago'}'s looking good! ${top.name} is ${describeBusyness(top.busyness.level, top.busyness.trend)} rn. Check poppin.app for more`;
    }
    return "Hey! Having trouble checking the vibes rn. Hit up poppin.app for live updates";
  }
}

/**
 * Main function to get Pia's recommendation
 */
export async function getPiaRecommendation(userMessage: string): Promise<PiaResponse> {
  // Extract neighborhood from message
  const neighborhood = extractNeighborhood(userMessage);

  // Get top venues
  const recommendations = await getTopVenues(neighborhood, 5);

  // Generate Pia's response
  const message = await generatePiaResponse(userMessage, recommendations, neighborhood);

  return {
    message,
    recommendations,
    neighborhood: neighborhood || undefined,
  };
}

/**
 * Generate a weekend update post for Instagram
 */
export async function generateWeekendPost(): Promise<{
  caption: string;
  topVenues: VenueRecommendation[];
}> {
  // Get top 5 busiest venues city-wide
  const topVenues = await getTopVenues(null, 5);

  const currentTime = new Date().toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
  });

  // Group by neighborhood for the post
  const byNeighborhood = new Map<string, VenueRecommendation[]>();
  for (const venue of topVenues) {
    const hood = venue.neighborhood || 'Chicago';
    if (!byNeighborhood.has(hood)) {
      byNeighborhood.set(hood, []);
    }
    byNeighborhood.get(hood)!.push(venue);
  }

  const prompt = `It's ${currentTime} in Chicago. Generate an Instagram post about where's hot tonight.

Top venues right now:
${topVenues.map(v => `- ${v.name} (${v.neighborhood || 'Chicago'}): ${describeBusyness(v.busyness.level, v.busyness.trend)}`).join('\n')}

Write a short, punchy Instagram caption (under 200 chars) with relevant emojis. Include a call to action mentioning poppin.app. Make it sound like Pia - fun, insider knowledge, slightly sarcastic.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 200,
      system: PIA_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find(block => block.type === 'text');
    const caption = textBlock?.text || `Chicago's going off tonight! Check poppin.app for the vibes`;

    return { caption, topVenues };
  } catch (error) {
    console.error('Error generating weekend post:', error);
    return {
      caption: `Weekend vibes loading... Check poppin.app to see what's hot in Chicago tonight`,
      topVenues,
    };
  }
}

/**
 * Generate a story update (shorter, more urgent)
 */
export async function generateStoryUpdate(neighborhood?: string): Promise<string> {
  const venues = await getTopVenues(neighborhood, 3);

  if (venues.length === 0) {
    return neighborhood
      ? `${neighborhood} data loading... check poppin.app`
      : `Chicago vibes loading... check poppin.app`;
  }

  const hottest = venues[0];
  const hood = neighborhood || hottest.neighborhood || 'Chicago';
  const busyness = describeBusyness(hottest.busyness.level, hottest.busyness.trend);

  // Quick story format - no AI needed for this
  if (hottest.busyness.level > 75) {
    return `${hood} RIGHT NOW: ${hottest.name} is ${busyness}! ${hottest.waitMinutes ? `~${hottest.waitMinutes}min wait` : ''} - poppin.app`;
  } else if (hottest.busyness.level > 50) {
    return `${hood} update: ${hottest.name} is ${busyness}. Good time to head out! - poppin.app`;
  } else {
    return `${hood} is quiet rn. Perfect time to get there early! - poppin.app`;
  }
}
