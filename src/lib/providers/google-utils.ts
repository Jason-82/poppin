/**
 * Google Places Utility
 *
 * Provides functions to search for venues and get Place IDs,
 * plus historical busyness patterns based on venue type and time.
 */

import { VenueType } from '@prisma/client';

// Helper to get Chicago time
function getChicagoTime(date: Date = new Date()): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
}

interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string;
  types: string[];
}

// Cache for place search results
const searchCache = new Map<string, { placeId: string; searchedAt: number }>();
const SEARCH_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Search for a venue in Google Places and return the Place ID
 */
export async function findGooglePlaceId(
  venue: { name: string; address: string; latitude: number; longitude: number }
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return null;
  }

  // Check cache first
  const cacheKey = `${venue.name}:${venue.address}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.searchedAt < SEARCH_CACHE_TTL) {
    return cached.placeId;
  }

  try {
    // Use Text Search to find the venue
    const url = 'https://places.googleapis.com/v1/places:searchText';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
      },
      body: JSON.stringify({
        textQuery: `${venue.name} ${venue.address}`,
        locationBias: {
          circle: {
            center: {
              latitude: venue.latitude,
              longitude: venue.longitude,
            },
            radius: 500, // 500 meters
          },
        },
        maxResultCount: 1,
      }),
    });

    if (!response.ok) {
      console.warn(`[GooglePlaces] Search failed for ${venue.name}: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.places && data.places.length > 0) {
      const placeId = data.places[0].id;

      // Cache the result
      searchCache.set(cacheKey, {
        placeId,
        searchedAt: Date.now(),
      });

      console.log(`[GooglePlaces] Found Place ID for ${venue.name}: ${placeId}`);
      return placeId;
    }

    return null;
  } catch (error) {
    console.error(`[GooglePlaces] Error searching for ${venue.name}:`, error);
    return null;
  }
}

/**
 * Get expected busyness for a venue based on historical patterns
 * This serves as a sanity check against live data
 */
export function getExpectedBusyness(
  venueType: VenueType,
  date: Date = new Date()
): { expectedLevel: number; confidence: number; description: string } {
  const chicagoTime = getChicagoTime(date);
  const hour = chicagoTime.getHours();
  const dayOfWeek = chicagoTime.getDay();

  const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
  const isFriday = dayOfWeek === 5;
  const isSaturday = dayOfWeek === 6;
  const isSunday = dayOfWeek === 0;
  const isThursday = dayOfWeek === 4;

  let expectedLevel: number;
  let description: string;

  switch (venueType) {
    case 'bar':
      ({ level: expectedLevel, description } = getBarExpectedBusyness(hour, isWeekend, isFriday, isSaturday, isSunday));
      break;
    case 'club':
      ({ level: expectedLevel, description } = getClubExpectedBusyness(hour, isFriday, isSaturday));
      break;
    case 'latin_dance':
      ({ level: expectedLevel, description } = getLatinExpectedBusyness(hour, isThursday, isFriday, isSaturday));
      break;
    default:
      ({ level: expectedLevel, description } = getBarExpectedBusyness(hour, isWeekend, isFriday, isSaturday, isSunday));
  }

  // Confidence is lower during transition hours and higher during predictable times
  let confidence = 0.6; // Base confidence

  // Higher confidence during clearly busy or clearly dead times
  if (expectedLevel > 70 || expectedLevel < 20) {
    confidence = 0.8;
  }

  // Lower confidence during transition hours (opening, closing)
  if ((hour >= 16 && hour <= 18) || (hour >= 21 && hour <= 22)) {
    confidence = 0.4;
  }

  return { expectedLevel, confidence, description };
}

function getBarExpectedBusyness(
  hour: number,
  isWeekend: boolean,
  isFriday: boolean,
  isSaturday: boolean,
  isSunday: boolean
): { level: number; description: string } {
  // Friday/Saturday nights
  if (isFriday || isSaturday) {
    if (hour >= 22 || hour < 2) return { level: 80, description: 'Peak weekend night' };
    if (hour >= 20 && hour < 22) return { level: 65, description: 'Evening crowd building' };
    if (hour >= 17 && hour < 20) return { level: 50, description: 'Happy hour/dinner' };
    if (hour >= 12 && hour < 17) return { level: 25, description: 'Afternoon' };
    if (hour >= 10 && hour < 12) return { level: 15, description: 'Late morning' };
    return { level: 5, description: 'Early morning - likely closed' };
  }

  // Sunday
  if (isSunday) {
    if (hour >= 11 && hour < 15) return { level: 40, description: 'Brunch crowd' };
    if (hour >= 15 && hour < 20) return { level: 30, description: 'Afternoon' };
    if (hour >= 20 && hour < 23) return { level: 35, description: 'Sunday evening' };
    return { level: 10, description: 'Off-hours' };
  }

  // Weekday (Mon-Thu)
  if (hour >= 22 || hour < 1) return { level: 45, description: 'Late night weekday' };
  if (hour >= 17 && hour < 22) return { level: 40, description: 'After-work crowd' };
  if (hour >= 12 && hour < 17) return { level: 20, description: 'Afternoon - typically slow' };
  if (hour >= 10 && hour < 12) return { level: 10, description: 'Late morning - typically slow' };
  return { level: 5, description: 'Early morning - likely closed' };
}

function getClubExpectedBusyness(
  hour: number,
  isFriday: boolean,
  isSaturday: boolean
): { level: number; description: string } {
  if (isFriday || isSaturday) {
    if (hour >= 0 && hour < 3) return { level: 90, description: 'Peak club hours' };
    if (hour >= 23) return { level: 75, description: 'Getting busy' };
    if (hour >= 21 && hour < 23) return { level: 40, description: 'Opening/early arrivals' };
    return { level: 5, description: 'Clubs typically closed' };
  }

  // Weekday - most clubs closed
  if (hour >= 22 || hour < 2) return { level: 25, description: 'Limited weekday operation' };
  return { level: 5, description: 'Clubs typically closed on weekdays' };
}

function getLatinExpectedBusyness(
  hour: number,
  isThursday: boolean,
  isFriday: boolean,
  isSaturday: boolean
): { level: number; description: string } {
  const isLatinNight = isThursday || isFriday || isSaturday;

  if (isLatinNight) {
    if (hour >= 23 || hour < 1) return { level: 85, description: 'Peak social dancing' };
    if (hour >= 21 && hour < 23) return { level: 70, description: 'Lessons ending, social starting' };
    if (hour >= 19 && hour < 21) return { level: 45, description: 'Lesson time' };
    return { level: 5, description: 'Off-hours' };
  }

  // Off nights - smaller events
  if (hour >= 19 && hour < 22) return { level: 20, description: 'Possible practice/small class' };
  return { level: 5, description: 'Off-night, likely closed' };
}

/**
 * Check if a live reading seems reasonable given expected patterns
 * Returns a multiplier for confidence (0.5 = suspicious, 1.0 = reasonable)
 */
export function validateLiveReading(
  liveLevel: number,
  venueType: VenueType,
  date: Date = new Date()
): { isReasonable: boolean; confidenceMultiplier: number; reason: string } {
  const { expectedLevel, description } = getExpectedBusyness(venueType, date);

  // Calculate how far off the live reading is from expected
  const difference = Math.abs(liveLevel - expectedLevel);

  // If within 30 points, consider it reasonable
  if (difference <= 30) {
    return {
      isReasonable: true,
      confidenceMultiplier: 1.0,
      reason: `Live reading ${liveLevel}% is reasonable for "${description}" (expected ~${expectedLevel}%)`,
    };
  }

  // If 30-50 points off, it's questionable
  if (difference <= 50) {
    return {
      isReasonable: true,
      confidenceMultiplier: 0.7,
      reason: `Live reading ${liveLevel}% is higher/lower than typical for "${description}" (expected ~${expectedLevel}%)`,
    };
  }

  // More than 50 points off is suspicious
  return {
    isReasonable: false,
    confidenceMultiplier: 0.4,
    reason: `Live reading ${liveLevel}% is unusual for "${description}" (expected ~${expectedLevel}%) - data may be inaccurate`,
  };
}
