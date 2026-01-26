/**
 * Cron endpoint for scraping events
 * Runs weekly via Vercel cron
 *
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/scrape-events",
 *     "schedule": "0 6 * * 1"  // Every Monday at 6am UTC
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import puppeteer, { Browser, Page } from 'puppeteer-core';
import * as stringSimilarity from 'string-similarity';
import { prisma } from '@/lib/prisma';
import { EventType, EventSource } from '@prisma/client';

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

interface ScrapedEvent {
  name: string;
  venueName: string;
  date: Date;
  startTime?: string;
  sourceUrl: string;
}

// Minimum similarity score for venue matching
const MIN_MATCH_SCORE = 0.6;

export const maxDuration = 300; // 5 minutes max for Vercel
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const browserEndpoint = process.env.BROWSER_WS_ENDPOINT;
  if (!browserEndpoint) {
    return NextResponse.json(
      { error: 'BROWSER_WS_ENDPOINT not configured' },
      { status: 500 }
    );
  }

  let browser: Browser | null = null;

  try {
    console.log('Starting event scrape...');

    // Load venues for matching
    const venues = await prisma.venue.findMany({
      select: { id: true, name: true, address: true },
    });
    console.log(`Loaded ${venues.length} venues for matching`);

    // Connect to Browserless
    browser = await puppeteer.connect({
      browserWSEndpoint: browserEndpoint,
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Scrape Do312
    const events = await scrapeDo312(page);
    console.log(`Scraped ${events.length} events`);

    // Match and save
    const result = await saveEvents(events, venues);

    await browser.close();

    return NextResponse.json({
      success: true,
      scraped: events.length,
      saved: result.saved,
      unmatched: result.unmatched.length,
      unmatchedVenues: result.unmatched.slice(0, 10),
    });
  } catch (error) {
    console.error('Scrape error:', error);
    if (browser) await browser.close();
    return NextResponse.json(
      { error: 'Scrape failed', details: String(error) },
      { status: 500 }
    );
  }
}

async function scrapeDo312(page: Page): Promise<ScrapedEvent[]> {
  const events: ScrapedEvent[] = [];

  try {
    await page.goto('https://do312.com/events/nightlife', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    await page.waitForSelector('.ds-event-card, .event-card, [data-event-id], .ds-listing', {
      timeout: 10000,
    }).catch(() => console.log('No event cards with primary selectors'));

    const scrapedData = await page.evaluate(() => {
      const results: Array<{
        name: string;
        venueName: string;
        dateStr: string;
        sourceUrl: string;
      }> = [];

      const eventElements = document.querySelectorAll(
        '.ds-event-card, .event-card, [data-event-id], .ds-listing'
      );

      eventElements.forEach((el) => {
        try {
          const nameEl = el.querySelector(
            '.ds-listing-event-title, .event-title, h3, .title, [class*="title"]'
          );
          const venueEl = el.querySelector(
            '.ds-venue-name, .venue-name, .venue, [class*="venue"]'
          );
          const dateEl = el.querySelector(
            '.ds-event-date, .event-date, .date, time, [class*="date"]'
          );
          const linkEl = el.querySelector('a[href*="/events/"]') as HTMLAnchorElement;

          const name = nameEl?.textContent?.trim();
          const venueName = venueEl?.textContent?.trim();
          const dateStr = dateEl?.textContent?.trim() || dateEl?.getAttribute('datetime') || '';

          if (name && venueName) {
            results.push({
              name,
              venueName,
              dateStr,
              sourceUrl: linkEl?.href || 'https://do312.com',
            });
          }
        } catch {
          // Skip malformed
        }
      });

      return results;
    });

    for (const item of scrapedData) {
      const date = parseDate(item.dateStr);
      if (date) {
        events.push({
          name: item.name,
          venueName: item.venueName,
          date,
          sourceUrl: item.sourceUrl,
        });
      }
    }
  } catch (error) {
    console.error('Do312 scrape error:', error);
  }

  return events;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) return date;

  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const match = dateStr.toLowerCase().match(/(\w+)\s+(\d{1,2})/);

  if (match) {
    const monthIndex = months.indexOf(match[1].slice(0, 3));
    if (monthIndex !== -1) {
      return new Date(new Date().getFullYear(), monthIndex, parseInt(match[2]));
    }
  }

  return null;
}

function detectEventType(name: string): EventType {
  const text = name.toLowerCase();
  if (/salsa|bachata|cumbia|reggaeton|latin/i.test(text)) return 'latin_dance';
  if (/swing|lindy/i.test(text)) return 'swing_dance';
  if (/live music|live band|concert/i.test(text)) return 'live_music';
  if (/dj|dance party|edm|house/i.test(text)) return 'dj_night';
  if (/karaoke/i.test(text)) return 'karaoke';
  if (/trivia|quiz/i.test(text)) return 'trivia';
  if (/happy hour/i.test(text)) return 'happy_hour';
  if (/ladies night/i.test(text)) return 'ladies_night';
  if (/industry/i.test(text)) return 'industry_night';
  if (/drag/i.test(text)) return 'drag_show';
  if (/comedy|stand-?up/i.test(text)) return 'comedy';
  if (/open mic/i.test(text)) return 'open_mic';
  if (/football|basketball|game day|sports/i.test(text)) return 'sports';
  return 'other';
}

async function saveEvents(
  events: ScrapedEvent[],
  venues: Array<{ id: string; name: string; address: string }>
): Promise<{ saved: number; unmatched: string[] }> {
  let saved = 0;
  const unmatched: string[] = [];
  const venueNames = venues.map((v) => v.name.toLowerCase());

  // Detect recurring patterns
  const patterns = new Map<string, { dayOfWeek: number; count: number }>();
  for (const event of events) {
    const key = `${event.venueName}:${event.name}`.toLowerCase();
    const dayOfWeek = event.date.getDay();
    const existing = patterns.get(key);
    if (existing && existing.dayOfWeek === dayOfWeek) {
      existing.count++;
    } else if (!existing) {
      patterns.set(key, { dayOfWeek, count: 1 });
    }
  }

  for (const event of events) {
    const match = stringSimilarity.findBestMatch(event.venueName.toLowerCase(), venueNames);

    if (match.bestMatch.rating < MIN_MATCH_SCORE) {
      if (!unmatched.includes(event.venueName)) unmatched.push(event.venueName);
      continue;
    }

    const patternKey = `${event.venueName}:${event.name}`.toLowerCase();
    const pattern = patterns.get(patternKey);
    if (!pattern || pattern.count < 2) continue; // Skip one-offs

    const venue = venues[match.bestMatchIndex];
    const eventType = detectEventType(event.name);
    const dayOfWeek = event.date.getDay();

    try {
      await prisma.recurringEvent.upsert({
        where: {
          venueId_dayOfWeek_eventType: {
            venueId: venue.id,
            dayOfWeek,
            eventType,
          },
        },
        update: {
          name: event.name,
          startTime: event.startTime || '21:00',
          endTime: '02:00',
          sourceUrl: event.sourceUrl,
          source: 'scraped' as EventSource,
          updatedAt: new Date(),
        },
        create: {
          venueId: venue.id,
          name: event.name,
          eventType,
          dayOfWeek,
          startTime: event.startTime || '21:00',
          endTime: '02:00',
          sourceUrl: event.sourceUrl,
          source: 'scraped' as EventSource,
          verified: false,
        },
      });
      saved++;
    } catch (error) {
      console.error(`Error saving "${event.name}":`, error);
    }
  }

  return { saved, unmatched };
}
