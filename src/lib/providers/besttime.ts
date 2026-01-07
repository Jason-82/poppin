/**
 * BestTime Provider
 *
 * Integrates with BestTime.app API to get real foot traffic data for venues.
 *
 * API Documentation: https://besttime.app/api/v1/documentation
 */

import { BusynessProvider, BusynessReading, BusynessForecast } from './types';
import { Venue } from '@prisma/client';
import { venueCache } from './besttime-cache';

interface BestTimeVenue {
  venue_id: string;
  venue_name: string;
  venue_address: string;
}

interface BestTimeSearchResponse {
  status: string;
  venues?: BestTimeVenue[];
  message?: string;
}

interface BestTimeLiveResponse {
  status: string;
  analysis?: {
    venue_live_busyness?: number;
    venue_live_busyness_available?: boolean;
  };
  message?: string;
}

interface BestTimeForecastResponse {
  status: string;
  analysis?: {
    day_info?: Array<{
      day_int: number;
      day_raw: Array<{
        hour: number;
        intensity_nr: number;
      }>;
    }>;
  };
  message?: string;
}

export class BestTimeProvider implements BusynessProvider {
  name = 'BestTime';
  private apiKey: string;
  private baseUrl = 'https://besttime.app/api/v1';

  // Rate limiting
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL_MS = 1000; // 1 second between requests

  constructor() {
    this.apiKey = process.env.BESTTIME_API_KEY || process.env.BUSYNESS_PROVIDER_API_KEY || '';
    if (!this.apiKey) {
      console.warn('BESTTIME_API_KEY not set - BestTime provider will not work');
    }
  }

  /**
   * Get current busyness level for a venue
   */
  async getBusynessNow(venue: Venue): Promise<BusynessReading | null> {
    if (!this.apiKey) {
      console.error('BestTime API key not configured');
      return null;
    }

    try {
      // Get or find BestTime venue ID
      const bestTimeVenueId = await this.getBestTimeVenueId(venue);

      if (!bestTimeVenueId) {
        console.warn(`Could not find BestTime venue ID for ${venue.name}`);
        return null;
      }

      // Rate limiting
      await this.rateLimit();

      // Get live busyness data
      const url = new URL(`${this.baseUrl}/forecasts/live`);
      url.searchParams.append('api_key_private', this.apiKey);
      url.searchParams.append('venue_id', bestTimeVenueId);

      const response = await fetch(url.toString());

      if (!response.ok) {
        console.error(`BestTime API error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data: BestTimeLiveResponse = await response.json();

      if (data.status !== 'OK' || !data.analysis?.venue_live_busyness_available) {
        console.warn(`Live busyness not available for venue ${venue.name}`);
        return null;
      }

      // BestTime returns busyness as a percentage (0-100)
      const level = data.analysis.venue_live_busyness ?? 0;

      return {
        level: Math.round(level),
        timestamp: new Date(),
        source: this.name,
      };
    } catch (error) {
      console.error('Error fetching BestTime live data:', error);
      return null;
    }
  }

  /**
   * Get forecasted busyness levels for upcoming hours
   */
  async getForecast(venue: Venue, hours: number): Promise<BusynessForecast[]> {
    if (!this.apiKey) {
      console.error('BestTime API key not configured');
      return [];
    }

    try {
      // Get or find BestTime venue ID
      const bestTimeVenueId = await this.getBestTimeVenueId(venue);

      if (!bestTimeVenueId) {
        console.warn(`Could not find BestTime venue ID for ${venue.name}`);
        return [];
      }

      // Rate limiting
      await this.rateLimit();

      // Get forecast data
      const url = new URL(`${this.baseUrl}/forecasts`);
      url.searchParams.append('api_key_private', this.apiKey);
      url.searchParams.append('venue_id', bestTimeVenueId);

      const response = await fetch(url.toString());

      if (!response.ok) {
        console.error(`BestTime API error: ${response.status} ${response.statusText}`);
        return [];
      }

      const data: BestTimeForecastResponse = await response.json();

      if (data.status !== 'OK' || !data.analysis?.day_info) {
        console.warn(`Forecast data not available for venue ${venue.name}`);
        return [];
      }

      // Parse forecast data into our format
      const forecast: BusynessForecast[] = [];
      const now = new Date();
      const currentHour = now.getHours();
      const currentDay = now.getDay();

      // BestTime returns data for the whole week
      // We need to extract upcoming hours from current time
      for (const dayData of data.analysis.day_info) {
        const dayOfWeek = dayData.day_int;

        for (const hourData of dayData.day_raw || []) {
          const hour = hourData.hour;

          // Calculate if this hour is in our forecast window
          const hoursFromNow = this.calculateHoursFromNow(
            currentDay,
            currentHour,
            dayOfWeek,
            hour
          );

          if (hoursFromNow >= 0 && hoursFromNow < hours) {
            // BestTime intensity_nr is typically 0-100
            const expectedLevel = Math.round(hourData.intensity_nr);

            forecast.push({
              hour,
              dayOfWeek,
              expectedLevel,
            });
          }
        }
      }

      // Sort by time from now
      forecast.sort((a, b) => {
        const aHours = this.calculateHoursFromNow(currentDay, currentHour, a.dayOfWeek, a.hour);
        const bHours = this.calculateHoursFromNow(currentDay, currentHour, b.dayOfWeek, b.hour);
        return aHours - bHours;
      });

      return forecast.slice(0, hours);
    } catch (error) {
      console.error('Error fetching BestTime forecast:', error);
      return [];
    }
  }

  /**
   * Get BestTime venue ID, using cache or searching if needed
   */
  private async getBestTimeVenueId(venue: Venue): Promise<string | null> {
    // Check cache first
    const cachedId = venueCache.get(venue.id);
    if (cachedId) {
      return cachedId;
    }

    // Search for venue
    const searchedId = await this.searchVenue(venue);
    if (searchedId) {
      // Cache the result
      venueCache.set(venue.id, searchedId);
      return searchedId;
    }

    return null;
  }

  /**
   * Search for a venue in BestTime's database
   */
  private async searchVenue(venue: Venue): Promise<string | null> {
    try {
      // Rate limiting
      await this.rateLimit();

      const url = new URL(`${this.baseUrl}/venues/search`);
      url.searchParams.append('api_key_private', this.apiKey);
      url.searchParams.append('q', venue.name);

      // Add location parameters if available
      if (venue.latitude && venue.longitude) {
        url.searchParams.append('lat', venue.latitude.toString());
        url.searchParams.append('lng', venue.longitude.toString());
        url.searchParams.append('radius', '500'); // 500 meter radius
      }

      const response = await fetch(url.toString());

      if (!response.ok) {
        console.error(`BestTime search error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data: BestTimeSearchResponse = await response.json();

      if (data.status !== 'OK' || !data.venues || data.venues.length === 0) {
        console.warn(`No BestTime venues found for ${venue.name}`);
        return null;
      }

      // Return the first match
      // In a production system, you might want to implement fuzzy matching
      // to ensure you get the best match
      const bestMatch = data.venues[0];
      console.log(`Matched venue "${venue.name}" to BestTime venue "${bestMatch.venue_name}" (ID: ${bestMatch.venue_id})`);

      return bestMatch.venue_id;
    } catch (error) {
      console.error('Error searching BestTime venues:', error);
      return null;
    }
  }

  /**
   * Calculate hours from now to a specific day/hour
   */
  private calculateHoursFromNow(
    currentDay: number,
    currentHour: number,
    targetDay: number,
    targetHour: number
  ): number {
    let dayDiff = targetDay - currentDay;

    // Handle week wrap-around
    if (dayDiff < 0) {
      dayDiff += 7;
    }

    const hourDiff = targetHour - currentHour;
    return dayDiff * 24 + hourDiff;
  }

  /**
   * Simple rate limiting to avoid hammering the API
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL_MS) {
      const waitTime = this.MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }
}
