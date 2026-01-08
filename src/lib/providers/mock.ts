/**
 * Mock Busyness Provider
 *
 * Generates realistic time-based busyness data for testing without external API calls.
 *
 * Patterns:
 * - Weekday: Low until 5pm, builds to peak at 10pm, dies down by 2am
 * - Weekend: Starts building at 7pm, peak at midnight, stays busy until 3am
 * - Clubs peak later than bars
 * - Latin dance venues busier on Thursday/Friday/Saturday
 */

import { Venue, VenueType } from '@prisma/client';
import { BusynessProvider, BusynessReading, BusynessForecast } from './types';

// Helper to get Chicago time from any Date
function getChicagoTime(date: Date = new Date()): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
}

export class MockProvider implements BusynessProvider {
  name = 'MockProvider';

  /**
   * Get current busyness level for a venue based on time patterns
   * Uses Chicago timezone for accurate nightlife patterns
   */
  async getBusynessNow(venue: Venue): Promise<BusynessReading | null> {
    const now = new Date();
    const chicagoNow = getChicagoTime(now);
    const level = this.calculateBusynessLevel(venue, chicagoNow);

    // Add some randomness to simulate real-world variation (±10%)
    const randomVariation = (Math.random() - 0.5) * 20;
    const finalLevel = Math.max(0, Math.min(100, level + randomVariation));

    return {
      level: Math.round(finalLevel),
      timestamp: now,
      source: this.name,
    };
  }

  /**
   * Get forecasted busyness for upcoming hours
   */
  async getForecast(venue: Venue, hours: number): Promise<BusynessForecast[]> {
    const forecast: BusynessForecast[] = [];
    const now = new Date();

    for (let i = 0; i < hours; i++) {
      const futureTime = new Date(now.getTime() + i * 60 * 60 * 1000);
      const chicagoFutureTime = getChicagoTime(futureTime);
      const level = this.calculateBusynessLevel(venue, chicagoFutureTime);

      forecast.push({
        hour: chicagoFutureTime.getHours(),
        dayOfWeek: chicagoFutureTime.getDay(),
        expectedLevel: Math.round(level),
      });
    }

    return forecast;
  }

  /**
   * Calculate busyness level based on venue type and time
   */
  private calculateBusynessLevel(venue: Venue, time: Date): number {
    const hour = time.getHours();
    const dayOfWeek = time.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isFriday = dayOfWeek === 5;
    const isThursday = dayOfWeek === 4;

    // Generate a seeded random number based on venue ID for consistency
    const venueSeed = this.hashString(venue.id) % 100;
    const venueModifier = (venueSeed - 50) / 10; // -5 to +5

    let baseLevel = 0;

    switch (venue.type) {
      case VenueType.bar:
        baseLevel = this.calculateBarBusyness(hour, isWeekend);
        break;
      case VenueType.club:
        baseLevel = this.calculateClubBusyness(hour, isWeekend, isFriday);
        break;
      case VenueType.latin_dance:
        baseLevel = this.calculateLatinDanceBusyness(
          hour,
          isWeekend,
          isThursday,
          isFriday
        );
        break;
    }

    // Apply venue-specific modifier
    return Math.max(0, Math.min(100, baseLevel + venueModifier));
  }

  /**
   * Bar busyness pattern:
   * Weekday: Low until 5pm, builds to peak at 10pm, dies down by 2am
   * Weekend: Similar but starts earlier
   */
  private calculateBarBusyness(hour: number, isWeekend: boolean): number {
    if (isWeekend) {
      // Weekend pattern
      if (hour >= 0 && hour < 3) return 70 - hour * 20; // 70 -> 30 from midnight to 3am
      if (hour >= 3 && hour < 12) return 5; // Very quiet morning
      if (hour >= 12 && hour < 17) return 20; // Lunch/afternoon
      if (hour >= 17 && hour < 19) return 40 + (hour - 17) * 10; // Happy hour build-up
      if (hour >= 19 && hour < 22) return 60 + (hour - 19) * 10; // Building to peak
      if (hour >= 22) return 90; // Peak hours
    } else {
      // Weekday pattern
      if (hour >= 0 && hour < 2) return 50 - hour * 20; // 50 -> 10 from midnight to 2am
      if (hour >= 2 && hour < 12) return 5; // Very quiet morning
      if (hour >= 12 && hour < 17) return 15; // Lunch/afternoon
      if (hour >= 17 && hour < 19) return 30 + (hour - 17) * 10; // Happy hour
      if (hour >= 19 && hour < 22) return 50 + (hour - 19) * 13; // Building to peak
      if (hour >= 22) return 80; // Peak hours
    }
    return 10;
  }

  /**
   * Club busyness pattern:
   * Peaks later than bars (midnight-2am)
   * Weekend-focused
   */
  private calculateClubBusyness(
    hour: number,
    isWeekend: boolean,
    isFriday: boolean
  ): number {
    const isPartyNight = isWeekend || isFriday;

    if (isPartyNight) {
      // Party night pattern
      if (hour >= 0 && hour < 3) return 95 - hour * 10; // Peak until 3am
      if (hour >= 3 && hour < 5) return 65 - (hour - 3) * 20; // Dying down
      if (hour >= 5 && hour < 20) return 5; // Closed/very quiet
      if (hour >= 20 && hour < 22) return 20 + (hour - 20) * 10; // Starting to fill
      if (hour >= 22) return 40 + (hour - 22) * 25; // Building to peak
    } else {
      // Weekday pattern - generally quieter
      if (hour >= 0 && hour < 2) return 40 - hour * 15;
      if (hour >= 2 && hour < 20) return 5; // Closed/very quiet
      if (hour >= 20 && hour < 22) return 10 + (hour - 20) * 5;
      if (hour >= 22) return 20 + (hour - 22) * 10;
    }
    return 5;
  }

  /**
   * Latin dance venue busyness pattern:
   * Busier on Thursday/Friday/Saturday
   * Peak around 11pm-1am when lessons end and social dancing starts
   */
  private calculateLatinDanceBusyness(
    hour: number,
    isWeekend: boolean,
    isThursday: boolean,
    isFriday: boolean
  ): number {
    const isLatinNight = isWeekend || isThursday || isFriday;

    if (isLatinNight) {
      // Latin night pattern
      if (hour >= 0 && hour < 2) return 90 - hour * 15; // Peak continues past midnight
      if (hour >= 2 && hour < 4) return 60 - (hour - 2) * 20; // Winding down
      if (hour >= 4 && hour < 19) return 5; // Closed/very quiet
      if (hour >= 19 && hour < 21) return 30 + (hour - 19) * 15; // Lessons starting
      if (hour >= 21 && hour < 23) return 60 + (hour - 21) * 15; // Building to social dancing
      if (hour >= 23) return 90; // Peak social dancing hours
    } else {
      // Off night - maybe beginner lessons only
      if (hour >= 0 && hour < 19) return 5;
      if (hour >= 19 && hour < 21) return 25; // Small lesson
      if (hour >= 21 && hour < 22) return 30;
      if (hour >= 22) return 20; // Winding down
    }
    return 5;
  }

  /**
   * Simple hash function to generate consistent random-looking numbers from venue ID
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}
