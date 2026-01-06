/**
 * Busyness Provider Types
 *
 * Defines the interface for busyness data providers.
 * This allows easy swapping between mock data and real APIs (Google Places, BestTime, etc.)
 */

import { Venue } from '@prisma/client';

/**
 * Core interface that all busyness providers must implement
 */
export interface BusynessProvider {
  /** Name of the provider (e.g., "MockProvider", "GooglePlaces", "BestTime") */
  name: string;

  /**
   * Get current busyness level for a venue
   * @param venue The venue to get busyness for
   * @returns BusynessReading or null if data unavailable
   */
  getBusynessNow(venue: Venue): Promise<BusynessReading | null>;

  /**
   * Get forecasted busyness levels for upcoming hours
   * @param venue The venue to get forecast for
   * @param hours Number of hours to forecast
   * @returns Array of forecasted busyness levels
   */
  getForecast(venue: Venue, hours: number): Promise<BusynessForecast[]>;
}

/**
 * A single busyness reading from a provider
 */
export interface BusynessReading {
  /** Busyness level on a 0-100 scale (0 = empty, 100 = at capacity) */
  level: number;

  /** When this reading was taken */
  timestamp: Date;

  /** Source identifier (provider name) */
  source: string;
}

/**
 * Forecasted busyness for a specific time period
 */
export interface BusynessForecast {
  /** Hour of day (0-23) */
  hour: number;

  /** Day of week (0-6, where 0 = Sunday) */
  dayOfWeek: number;

  /** Expected busyness level (0-100) */
  expectedLevel: number;
}
