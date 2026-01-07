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
   * Tries live data first, falls back to forecast data
   */
  async getBusynessNow(venue: Venue): Promise<BusynessReading | null> {
    if (!this.apiKey) {
      console.error('BestTime API key not configured');
      return null;
    }

    try {
      // Check if we have a cached venue ID for live data
      let bestTimeVenueId = venueCache.get(venue.id);

      // If we have a cached venue ID, try live data first
      if (bestTimeVenueId) {
        const liveReading = await this.getLiveData(venue.name, bestTimeVenueId);
        if (liveReading) {
          return liveReading;
        }
        console.log(`Live data not available for ${venue.name}, falling back to forecast`);
      }

      // No cached ID or live failed - do POST /forecasts to get venue ID + forecast
      await this.rateLimit();

      const params = new URLSearchParams({
        api_key_private: this.apiKey,
        venue_name: venue.name,
        venue_address: venue.address,
      });

      const url = `${this.baseUrl}/forecasts?${params.toString()}`;

      const response = await fetch(url, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`BestTime API error for ${venue.name}: ${response.status}`, errorText.substring(0, 200));
        return null;
      }

      const data = await response.json();

      if (data.status !== 'OK') {
        console.warn(`BestTime error for ${venue.name}: ${data.message || 'Unknown error'}`);
        return null;
      }

      // Cache the venue ID for future live data calls
      if (data.venue_info?.venue_id) {
        const newVenueId: string = data.venue_info.venue_id;
        venueCache.set(venue.id, newVenueId);
        console.log(`Cached BestTime venue ID for ${venue.name}: ${newVenueId}`);

        // Now try live data with the new venue ID
        const liveReading = await this.getLiveData(venue.name, newVenueId);
        if (liveReading) {
          return liveReading;
        }
      }

      // Fall back to forecast data from the POST response
      return this.extractForecastData(venue.name, data);
    } catch (error) {
      console.error('Error fetching BestTime data:', error);
      return null;
    }
  }

  /**
   * Get live busyness data using venue ID
   */
  private async getLiveData(venueName: string, venueId: string): Promise<BusynessReading | null> {
    try {
      await this.rateLimit();

      const params = new URLSearchParams({
        api_key_private: this.apiKey,
        venue_id: venueId,
      });

      const url = `${this.baseUrl}/forecasts/live?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
      });

      if (!response.ok) {
        console.log(`Live data request failed for ${venueName}: ${response.status}`);
        return null;
      }

      const data: BestTimeLiveResponse = await response.json();

      if (data.status !== 'OK') {
        console.log(`Live data not OK for ${venueName}: ${data.message || 'Unknown error'}`);
        return null;
      }

      // Check if live busyness is available
      if (!data.analysis?.venue_live_busyness_available) {
        console.log(`Live busyness not available for ${venueName}`);
        return null;
      }

      const level = data.analysis.venue_live_busyness;
      if (level === undefined || level === null || isNaN(level)) {
        console.log(`Invalid live level for ${venueName}: ${level}`);
        return null;
      }

      console.log(`BestTime LIVE: ${venueName} - Level ${level}`);

      return {
        level: Math.round(level),
        timestamp: new Date(),
        source: `${this.name} (Live)`,
      };
    } catch (error) {
      console.error(`Error fetching live data for ${venueName}:`, error);
      return null;
    }
  }

  /**
   * Extract busyness from forecast data for current day/hour
   */
  private extractForecastData(venueName: string, data: { analysis?: Record<string, unknown> }): BusynessReading | null {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
    const currentHour = now.getHours();

    const analysis = data.analysis;
    if (!analysis) {
      console.warn(`No analysis data for ${venueName}. Response keys: ${Object.keys(data).join(', ')}`);
      return null;
    }

    // Log the analysis structure to debug
    console.log(`BestTime analysis keys for ${venueName}: ${Object.keys(analysis).join(', ')}`);

    // Find current day's data (BestTime uses Monday=0 to Sunday=6, we need to convert)
    // JavaScript: Sunday=0, Monday=1, ... Saturday=6
    // BestTime: Monday=0, Tuesday=1, ... Sunday=6
    const bestTimeDay = currentDay === 0 ? 6 : currentDay - 1;

    // BestTime might use different keys for days - try multiple formats
    let dayData = (analysis[bestTimeDay] || analysis[`day_int_${bestTimeDay}`]) as { day_raw?: Array<{ hour: number; intensity_nr?: number; intensity?: number }> } | undefined;

    // If no direct index, look for day_info array
    if (!dayData && analysis.day_info && Array.isArray(analysis.day_info)) {
      dayData = (analysis.day_info as Array<{ day_int: number; day_raw?: Array<{ hour: number; intensity_nr?: number; intensity?: number }> }>).find((d) => d.day_int === bestTimeDay);
    }

    // Also try week_raw if available
    if (!dayData && analysis.week_raw && Array.isArray(analysis.week_raw)) {
      // week_raw is a flat array of 7*24 = 168 hourly values
      const hourIndex = bestTimeDay * 24 + currentHour;
      const intensity = (analysis.week_raw as number[])[hourIndex];
      if (intensity !== undefined) {
        console.log(`BestTime FORECAST: ${venueName} - Day ${bestTimeDay}, Hour ${currentHour}, Level ${intensity} (from week_raw)`);
        return {
          level: Math.round(intensity),
          timestamp: new Date(),
          source: `${this.name} (Forecast)`,
        };
      }
    }

    if (!dayData) {
      console.warn(`No data for day ${bestTimeDay} for ${venueName}. Analysis structure: ${JSON.stringify(analysis).substring(0, 300)}`);
      return null;
    }

    // day_raw contains hourly data
    const dayRaw = dayData.day_raw || (dayData as unknown as Array<{ hour: number; intensity_nr?: number; intensity?: number }>);
    if (!Array.isArray(dayRaw)) {
      console.warn(`day_raw is not array for ${venueName}: ${typeof dayRaw}`);
      return null;
    }

    // Find the busyness for current hour
    const hourData = dayRaw.find((h) => h.hour === currentHour);

    let level: number | undefined;
    if (hourData && hourData.intensity_nr !== undefined) {
      level = hourData.intensity_nr;
    } else if (hourData && hourData.intensity !== undefined) {
      level = hourData.intensity;
    } else {
      // Try to interpolate from nearby hours
      const nearestHour = dayRaw.reduce((nearest: { hour: number; intensity_nr?: number; intensity?: number } | null, h) => {
        if (!nearest) return h;
        const currentDiff = Math.abs(h.hour - currentHour);
        const nearestDiff = Math.abs(nearest.hour - currentHour);
        return currentDiff < nearestDiff ? h : nearest;
      }, null);

      if (nearestHour) {
        level = nearestHour.intensity_nr ?? nearestHour.intensity;
      }
    }

    // Validate level before returning
    if (level === undefined || level === null || isNaN(level)) {
      console.warn(`Invalid level for ${venueName}: ${level}. Hour data: ${JSON.stringify(hourData)}`);
      return null;
    }

    console.log(`BestTime FORECAST: ${venueName} - Day ${bestTimeDay}, Hour ${currentHour}, Level ${level}`);

    return {
      level: Math.round(level),
      timestamp: new Date(),
      source: `${this.name} (Forecast)`,
    };
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
   * Search for a venue in BestTime's database using the forecast/new endpoint
   * This creates a new forecast and returns venue info
   */
  private async searchVenue(venue: Venue): Promise<string | null> {
    try {
      // Rate limiting
      await this.rateLimit();

      // BestTime API: All parameters in query string
      const params = new URLSearchParams({
        api_key_private: this.apiKey,
        venue_name: venue.name,
        venue_address: venue.address,
      });

      const url = `${this.baseUrl}/forecasts?${params.toString()}`;

      console.log(`BestTime POST forecast for: ${venue.name} at ${venue.address}`);

      const response = await fetch(url, {
        method: 'POST',
      });

      const responseText = await response.text();
      console.log(`BestTime response status: ${response.status}, body preview: ${responseText.substring(0, 300)}`);

      if (!response.ok) {
        console.log(`POST forecast failed (${response.status}), response: ${responseText.substring(0, 500)}`);
        return null;
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        console.error('Failed to parse BestTime response as JSON');
        return null;
      }

      if (data.status !== 'OK' || !data.venue_info?.venue_id) {
        console.warn(`No BestTime venue found for ${venue.name}: ${data.message || JSON.stringify(data)}`);
        return null;
      }

      const venueId = data.venue_info.venue_id;
      console.log(`Found BestTime venue "${data.venue_info.venue_name}" (ID: ${venueId}) for "${venue.name}"`);

      return venueId;
    } catch (error) {
      console.error('Error searching BestTime venues:', error);
      return null;
    }
  }

  /**
   * We don't use this anymore - the POST /forecasts is the only way to search
   */
  private async searchVenueAlternative(venue: Venue): Promise<string | null> {
    console.log(`No alternative search available for ${venue.name}`);
    return null;
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
