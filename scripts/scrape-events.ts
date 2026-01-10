/**
 * Event Scraper for Do312 and other Chicago event sites
 *
 * This script runs separately from the main app to avoid blocking.
 * Run manually or via cron: npx ts-node scripts/scrape-events.ts
 *
 * Requirements:
 * - Chrome/Chromium installed, OR
 * - Set BROWSER_WS_ENDPOINT for remote browser service (Browserless, etc.)
 */

import puppeteer, { Browser, Page } from 'puppeteer-core';
import * as stringSimilarity from 'string-similarity';
import { PrismaClient, EventType, EventSource } from '@prisma/client';

const prisma = new PrismaClient();

// Configuration
const CONFIG = {
  // Use remote browser service if available, otherwise local Chrome
  browserEndpoint: process.env.BROWSER_WS_ENDPOINT,
  // Common Chrome paths
  chromePaths: [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ],
  // Minimum similarity score to consider a venue match (0-1)
  minMatchScore: 0.6,
  // Request delays to be respectful
  delayBetweenPages: 2000,
};

interface ScrapedEvent {
  name: string;
  venueName: string;
  venueAddress?: string;
  date: Date;
  startTime?: string;
  endTime?: string;
  description?: string;
  eventType?: string;
  coverCharge?: number;
  sourceUrl: string;
}

interface VenueMatch {
  venueId: string;
  venueName: string;
  score: number;
}

/**
 * Launch browser - supports both local Chrome and remote browser services
 */
async function launchBrowser(): Promise<Browser> {
  if (CONFIG.browserEndpoint) {
    console.log('Connecting to remote browser...');
    return puppeteer.connect({
      browserWSEndpoint: CONFIG.browserEndpoint,
    });
  }

  // Try to find local Chrome
  const executablePath = await findChrome();
  if (!executablePath) {
    throw new Error(
      'Chrome not found. Install Chrome or set BROWSER_WS_ENDPOINT for remote browser.'
    );
  }

  console.log(`Launching local Chrome: ${executablePath}`);
  return puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

async function findChrome(): Promise<string | null> {
  const fs = await import('fs');
  for (const path of CONFIG.chromePaths) {
    if (fs.existsSync(path)) {
      return path;
    }
  }
  return null;
}

/**
 * Scrape events from Do312
 */
async function scrapeDo312(page: Page): Promise<ScrapedEvent[]> {
  const events: ScrapedEvent[] = [];
  const baseUrl = 'https://do312.com';

  console.log('Scraping Do312...');

  try {
    // Navigate to nightlife/club events
    await page.goto(`${baseUrl}/events/nightlife`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait for event cards to load
    await page.waitForSelector('.ds-event-card, .event-card, [data-event-id]', {
      timeout: 10000,
    }).catch(() => console.log('No event cards found with primary selectors'));

    // Extract event data
    const scrapedEvents = await page.evaluate((baseUrl) => {
      const eventElements = document.querySelectorAll(
        '.ds-event-card, .event-card, [data-event-id], .ds-listing'
      );

      const results: Array<{
        name: string;
        venueName: string;
        venueAddress?: string;
        dateStr: string;
        startTime?: string;
        description?: string;
        sourceUrl: string;
      }> = [];

      eventElements.forEach((el) => {
        try {
          // Try various selectors for event name
          const nameEl = el.querySelector(
            '.ds-listing-event-title, .event-title, h3, .title, [class*="title"]'
          );
          const name = nameEl?.textContent?.trim();

          // Try various selectors for venue
          const venueEl = el.querySelector(
            '.ds-venue-name, .venue-name, .venue, [class*="venue"]'
          );
          const venueName = venueEl?.textContent?.trim();

          // Try to get date
          const dateEl = el.querySelector(
            '.ds-event-date, .event-date, .date, time, [class*="date"]'
          );
          const dateStr = dateEl?.textContent?.trim() || dateEl?.getAttribute('datetime');

          // Get link for source URL
          const linkEl = el.querySelector('a[href*="/events/"]') as HTMLAnchorElement;
          const sourceUrl = linkEl?.href || baseUrl;

          if (name && venueName) {
            results.push({
              name,
              venueName,
              dateStr: dateStr || '',
              sourceUrl,
            });
          }
        } catch (e) {
          // Skip malformed entries
        }
      });

      return results;
    }, baseUrl);

    // Parse dates and add to events
    for (const event of scrapedEvents) {
      const date = parseEventDate(event.dateStr);
      if (date) {
        events.push({
          name: event.name,
          venueName: event.venueName,
          date,
          sourceUrl: event.sourceUrl,
        });
      }
    }

    console.log(`Found ${events.length} events on Do312`);
  } catch (error) {
    console.error('Error scraping Do312:', error);
  }

  return events;
}

/**
 * Parse various date formats from event sites
 */
function parseEventDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  try {
    // Try standard parsing first
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }

    // Try common formats like "Fri, Jan 10" or "Friday, January 10"
    const months = [
      'jan', 'feb', 'mar', 'apr', 'may', 'jun',
      'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
    ];

    const match = dateStr.toLowerCase().match(/(\w+)\s+(\d{1,2})/);
    if (match) {
      const monthStr = match[1].slice(0, 3);
      const day = parseInt(match[2]);
      const monthIndex = months.indexOf(monthStr);

      if (monthIndex !== -1) {
        const year = new Date().getFullYear();
        return new Date(year, monthIndex, day);
      }
    }
  } catch (e) {
    // Ignore parse errors
  }

  return null;
}

/**
 * Load all venues from database for matching
 */
async function loadVenues(): Promise<Array<{ id: string; name: string; address: string }>> {
  return prisma.venue.findMany({
    select: {
      id: true,
      name: true,
      address: true,
    },
  });
}

/**
 * Match a scraped venue name to our database using fuzzy matching
 */
function matchVenue(
  scrapedName: string,
  venues: Array<{ id: string; name: string; address: string }>
): VenueMatch | null {
  const venueNames = venues.map((v) => v.name.toLowerCase());
  const searchName = scrapedName.toLowerCase();

  // Find best match
  const match = stringSimilarity.findBestMatch(searchName, venueNames);

  if (match.bestMatch.rating >= CONFIG.minMatchScore) {
    const matchedVenue = venues[match.bestMatchIndex];
    return {
      venueId: matchedVenue.id,
      venueName: matchedVenue.name,
      score: match.bestMatch.rating,
    };
  }

  return null;
}

/**
 * Detect event type from name/description
 */
function detectEventType(name: string, description?: string): EventType {
  const text = `${name} ${description || ''}`.toLowerCase();

  if (/salsa|bachata|cumbia|reggaeton|latin/i.test(text)) return 'latin_dance';
  if (/swing|lindy|hop/i.test(text)) return 'swing_dance';
  if (/live music|live band|concert/i.test(text)) return 'live_music';
  if (/dj|dance party|edm|house music/i.test(text)) return 'dj_night';
  if (/karaoke/i.test(text)) return 'karaoke';
  if (/trivia|quiz/i.test(text)) return 'trivia';
  if (/happy hour/i.test(text)) return 'happy_hour';
  if (/ladies night|ladies'/i.test(text)) return 'ladies_night';
  if (/industry night/i.test(text)) return 'industry_night';
  if (/drag|ru ?paul/i.test(text)) return 'drag_show';
  if (/comedy|stand-up|standup/i.test(text)) return 'comedy';
  if (/open mic/i.test(text)) return 'open_mic';
  if (/football|basketball|game day|sports/i.test(text)) return 'sports';

  return 'other';
}

/**
 * Detect if events are recurring based on patterns
 */
function detectRecurringPattern(
  events: ScrapedEvent[]
): Map<string, { dayOfWeek: number; count: number }> {
  const patterns = new Map<string, { dayOfWeek: number; count: number }>();

  for (const event of events) {
    const key = `${event.venueName}:${event.name}`.toLowerCase();
    const dayOfWeek = event.date.getDay();

    const existing = patterns.get(key);
    if (existing) {
      if (existing.dayOfWeek === dayOfWeek) {
        existing.count++;
      }
    } else {
      patterns.set(key, { dayOfWeek, count: 1 });
    }
  }

  return patterns;
}

/**
 * Save matched events to database
 */
async function saveEvents(
  events: ScrapedEvent[],
  venues: Array<{ id: string; name: string; address: string }>
): Promise<{ saved: number; unmatched: string[] }> {
  let saved = 0;
  const unmatched: string[] = [];

  // Detect recurring patterns
  const patterns = detectRecurringPattern(events);

  for (const event of events) {
    const match = matchVenue(event.venueName, venues);

    if (!match) {
      if (!unmatched.includes(event.venueName)) {
        unmatched.push(event.venueName);
      }
      continue;
    }

    const eventType = detectEventType(event.name, event.description);
    const dayOfWeek = event.date.getDay();

    // Check if this looks like a recurring event (appears multiple times same day)
    const patternKey = `${event.venueName}:${event.name}`.toLowerCase();
    const pattern = patterns.get(patternKey);
    const isRecurring = pattern && pattern.count >= 2;

    if (!isRecurring) {
      // Skip one-off events for now - we're focused on recurring
      continue;
    }

    try {
      await prisma.recurringEvent.upsert({
        where: {
          venueId_dayOfWeek_eventType: {
            venueId: match.venueId,
            dayOfWeek,
            eventType,
          },
        },
        update: {
          name: event.name,
          startTime: event.startTime || '21:00',
          endTime: event.endTime || '02:00',
          description: event.description,
          coverCharge: event.coverCharge,
          sourceUrl: event.sourceUrl,
          source: 'scraped' as EventSource,
          updatedAt: new Date(),
        },
        create: {
          venueId: match.venueId,
          name: event.name,
          eventType,
          dayOfWeek,
          startTime: event.startTime || '21:00',
          endTime: event.endTime || '02:00',
          description: event.description,
          coverCharge: event.coverCharge,
          sourceUrl: event.sourceUrl,
          source: 'scraped' as EventSource,
          verified: false,
        },
      });
      saved++;
    } catch (error) {
      console.error(`Error saving event "${event.name}":`, error);
    }
  }

  return { saved, unmatched };
}

/**
 * Main scraper function
 */
async function main() {
  console.log('='.repeat(50));
  console.log('Event Scraper Starting');
  console.log('='.repeat(50));

  let browser: Browser | null = null;

  try {
    // Load venues for matching
    const venues = await loadVenues();
    console.log(`Loaded ${venues.length} venues for matching`);

    // Launch browser
    browser = await launchBrowser();
    const page = await browser.newPage();

    // Set a realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Scrape events from Do312
    const events = await scrapeDo312(page);

    // Match and save events
    const result = await saveEvents(events, venues);

    console.log('='.repeat(50));
    console.log('Scraping Complete');
    console.log(`Saved: ${result.saved} recurring events`);
    if (result.unmatched.length > 0) {
      console.log(`\nUnmatched venues (${result.unmatched.length}):`);
      result.unmatched.slice(0, 20).forEach((v) => console.log(`  - ${v}`));
      if (result.unmatched.length > 20) {
        console.log(`  ... and ${result.unmatched.length - 20} more`);
      }
    }
    console.log('='.repeat(50));
  } catch (error) {
    console.error('Scraper error:', error);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
    await prisma.$disconnect();
  }
}

// Run if called directly
main().catch(console.error);
