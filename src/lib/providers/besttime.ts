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
   * API: POST /forecast/live (note: singular "forecast", not "forecasts")
   */
  private async getLiveData(venueName: string, venueId: string): Promise<BusynessReading | null> {
    try {
      await this.rateLimit();

      const params = new URLSearchParams({
        api_key_private: this.apiKey,
        venue_id: venueId,
      });

      // IMPORTANT: It's POST /forecast/live (singular), not GET /forecasts/live
      const url = `${this.baseUrl}/forecast/live?${params.toString()}`;

      const response = await fetch(url, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`Live data request failed for ${venueName}: ${response.status} - ${errorText.substring(0, 100)}`);
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
   * Uses hour_analysis array which contains structured hourly data with intensity_nr
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

    // Find current day's data (BestTime uses Monday=0 to Sunday=6, we need to convert)
    // JavaScript: Sunday=0, Monday=1, ... Saturday=6
    // BestTime: Monday=0, Tuesday=1, ... Sunday=6
    const bestTimeDay = currentDay === 0 ? 6 : currentDay - 1;

    // BestTime uses string keys "0" through "6" for days
    const dayKey = String(bestTimeDay);
    const dayData = analysis[dayKey] as Record<string, unknown> | undefined;

    if (!dayData) {
      console.warn(`No data for day ${bestTimeDay} for ${venueName}`);
      return null;
    }

    // Use hour_analysis array - this contains the structured hourly data
    // Format: [{"hour":6,"intensity_txt":"Closed","intensity_nr":999}, {"hour":7,"intensity_nr":45}, ...]
    const hourAnalysis = dayData.hour_analysis as Array<{
      hour: number;
      intensity_nr: number;
      intensity_txt?: string;
    }> | undefined;

    if (!hourAnalysis || !Array.isArray(hourAnalysis)) {
      console.warn(`No hour_analysis for ${venueName}. dayData keys: ${Object.keys(dayData).join(', ')}`);
      return null;
    }

    // Find the busyness for current hour
    let hourData = hourAnalysis.find((h) => h.hour === currentHour);

    // If no exact hour match, find nearest open hour
    if (!hourData) {
      // Find nearest hour that's not closed (intensity_nr !== 999)
      const openHours = hourAnalysis.filter(h => h.intensity_nr !== 999 && h.intensity_nr >= 0 && h.intensity_nr <= 100);
      if (openHours.length > 0) {
        hourData = openHours.reduce((nearest, h) => {
          const currentDiff = Math.abs(h.hour - currentHour);
          const nearestDiff = Math.abs(nearest.hour - currentHour);
          return currentDiff < nearestDiff ? h : nearest;
        });
        console.log(`No data for hour ${currentHour}, using nearest open hour ${hourData.hour}`);
      }
    }

    if (!hourData) {
      console.log(`No valid hour data for ${venueName} at hour ${currentHour}`);
      return null;
    }

    const level = hourData.intensity_nr;

    // intensity_nr = 999 means venue is closed at this hour
    if (level === 999) {
      console.log(`${venueName} is closed at hour ${currentHour}`);
      return null;
    }

    // Validate level is within expected range (0-100)
    if (level === undefined || level === null || isNaN(level) || level < 0 || level > 100) {
      console.warn(`Invalid level for ${venueName}: ${level}`);
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
