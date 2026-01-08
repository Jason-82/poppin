/**
 * Google Places Provider
 *
 * Uses Google Places API to get accurate open/closed status,
 * combined with time-based busyness estimation.
 *
 * Note: Google doesn't expose "Popular Times" via API, so we estimate
 * busyness based on time of day and venue type when open.
 */

import { Venue, VenueType } from '@prisma/client';
import { BusynessProvider, BusynessReading, BusynessForecast } from './types';

// Helper to get Chicago time
function getChicagoTime(date: Date = new Date()): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
}

interface PlaceDetailsResponse {
  currentOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  };
  regularOpeningHours?: {
    openNow?: boolean;
  };
}

// Cache for place details to reduce API calls
const placeCache = new Map<string, { openNow: boolean; checkedAt: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export class GooglePlacesProvider implements BusynessProvider {
  name = 'GooglePlaces';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_PLACES_API_KEY || '';
    if (!this.apiKey) {
      console.warn('GOOGLE_PLACES_API_KEY not set - provider will use estimates only');
    }
  }

  /**
   * Get current busyness for a venue
   * Uses Google Places for open/closed, estimates busyness when open
   */
  async getBusynessNow(venue: Venue): Promise<BusynessReading | null> {
    const chicagoTime = getChicagoTime();
    const hour = chicagoTime.getHours();
    const dayOfWeek = chicagoTime.getDay();

    // Check if venue is open via Google Places API
    const isOpen = await this.checkIfOpen(venue);

    // If confirmed closed, return -1
    if (isOpen === false) {
      console.log(`[GooglePlaces] ${venue.name}: CLOSED`);
      return {
        level: -1,
        timestamp: new Date(),
        source: `${this.name} (Closed)`,
      };
    }

    // Estimate busyness based on time and venue type
    const estimatedLevel = this.estimateBusyness(venue.type, hour, dayOfWeek);

    // Add some randomness (±10%)
    const variation = (Math.random() - 0.5) * 20;
    const finalLevel = Math.max(0, Math.min(100, estimatedLevel + variation));

    console.log(`[GooglePlaces] ${venue.name}: estimated ${Math.round(finalLevel)}% (${isOpen === true ? 'confirmed open' : 'assumed open'})`);

    return {
      level: Math.round(finalLevel),
      timestamp: new Date(),
      source: isOpen === true ? `${this.name} (Open)` : `${this.name} (Estimated)`,
    };
  }

  /**
   * Check if venue is currently open using Google Places API
   * Returns: true = open, false = closed, null = unknown
   */
  private async checkIfOpen(venue: Venue): Promise<boolean | null> {
    // Need Google Place ID to check
    if (!venue.googlePlaceId || !this.apiKey) {
      return null; // Can't determine, assume open during reasonable hours
    }

    // Check cache first
    const cached = placeCache.get(venue.googlePlaceId);
    if (cached && Date.now() - cached.checkedAt < CACHE_TTL) {
      return cached.openNow;
    }

    try {
      const url = `https://places.googleapis.com/v1/places/${venue.googlePlaceId}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'currentOpeningHours.openNow',
        },
      });

      if (!response.ok) {
        console.warn(`[GooglePlaces] API error for ${venue.name}: ${response.status}`);
        return null;
      }

      const data: PlaceDetailsResponse = await response.json();
      const openNow = data.currentOpeningHours?.openNow;

      if (openNow !== undefined) {
        // Cache the result
        placeCache.set(venue.googlePlaceId, {
          openNow,
          checkedAt: Date.now(),
        });
        return openNow;
      }

      return null;
    } catch (error) {
      console.error(`[GooglePlaces] Error checking ${venue.name}:`, error);
      return null;
    }
  }

  /**
   * Estimate busyness based on venue type, hour, and day
   * More sophisticated than MockProvider with realistic patterns
   */
  private estimateBusyness(type: VenueType, hour: number, dayOfWeek: number): number {
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
    const isFriday = dayOfWeek === 5;
    const isSaturday = dayOfWeek === 6;
    const isThursday = dayOfWeek === 4;

    switch (type) {
      case VenueType.bar:
        return this.estimateBarBusyness(hour, isWeekend, isFriday, isSaturday);
      case VenueType.club:
        return this.estimateClubBusyness(hour, isWeekend, isFriday, isSaturday);
      case VenueType.latin_dance:
        return this.estimateLatinBusyness(hour, isWeekend, isThursday, isFriday, isSaturday);
      default:
        return this.estimateBarBusyness(hour, isWeekend, isFriday, isSaturday);
    }
  }

  private estimateBarBusyness(hour: number, isWeekend: boolean, isFriday: boolean, isSaturday: boolean): number {
    // Friday/Saturday nights are busiest
    if (isFriday || isSaturday) {
      if (hour >= 22 || hour < 2) return 85;
      if (hour >= 20 && hour < 22) return 70;
      if (hour >= 18 && hour < 20) return 55;
      if (hour >= 16 && hour < 18) return 40; // Happy hour starting
      if (hour >= 11 && hour < 16) return 25;
      return 10;
    }

    // Sunday
    if (isWeekend && hour >= 11 && hour < 20) return 35; // Brunch/afternoon crowd
    if (isWeekend) return 20;

    // Weekday
    if (hour >= 22 || hour < 1) return 60;
    if (hour >= 20 && hour < 22) return 50;
    if (hour >= 17 && hour < 20) return 45; // After work
    if (hour >= 11 && hour < 17) return 20;
    return 5;
  }

  private estimateClubBusyness(hour: number, isWeekend: boolean, isFriday: boolean, isSaturday: boolean): number {
    // Clubs are mainly weekend destinations
    if (isFriday || isSaturday) {
      if (hour >= 0 && hour < 2) return 95; // Peak hours
      if (hour >= 23) return 85;
      if (hour >= 22 && hour < 23) return 65;
      if (hour >= 21 && hour < 22) return 40;
      return 5; // Clubs usually closed during day
    }

    // Weekday - most clubs closed or very quiet
    if (hour >= 22 || hour < 2) return 30;
    return 5;
  }

  private estimateLatinBusyness(
    hour: number,
    isWeekend: boolean,
    isThursday: boolean,
    isFriday: boolean,
    isSaturday: boolean
  ): number {
    // Latin nights are typically Thu/Fri/Sat
    const isLatinNight = isThursday || isFriday || isSaturday;

    if (isLatinNight) {
      if (hour >= 23 || hour < 1) return 90; // Social dancing peak
      if (hour >= 21 && hour < 23) return 75; // Lessons ending, social starting
      if (hour >= 19 && hour < 21) return 50; // Lessons
      return 5;
    }

    // Off nights - maybe small classes
    if (hour >= 19 && hour < 22) return 25;
    return 5;
  }

  /**
   * Get forecast (not supported by Google, use estimates)
   */
  async getForecast(venue: Venue, hours: number): Promise<BusynessForecast[]> {
    const forecast: BusynessForecast[] = [];
    const now = new Date();

    for (let i = 0; i < hours; i++) {
      const futureTime = new Date(now.getTime() + i * 60 * 60 * 1000);
      const chicagoFuture = getChicagoTime(futureTime);
      const hour = chicagoFuture.getHours();
      const dayOfWeek = chicagoFuture.getDay();

      const level = this.estimateBusyness(venue.type, hour, dayOfWeek);

      forecast.push({
        hour,
        dayOfWeek,
        expectedLevel: Math.round(level),
      });
    }

    return forecast;
  }
}
