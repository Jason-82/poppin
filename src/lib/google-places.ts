/**
 * Google Places API integration for importing venues
 *
 * Uses the Places API (New) - Text Search endpoint
 * https://developers.google.com/maps/documentation/places/web-service/text-search
 */

export interface GooglePlace {
  id: string;
  displayName: {
    text: string;
  };
  formattedAddress: string;
  location: {
    latitude: number;
    longitude: number;
  };
  types: string[];
  websiteUri?: string;
  nationalPhoneNumber?: string;
  regularOpeningHours?: {
    weekdayDescriptions: string[];
  };
  primaryType?: string;
  addressComponents?: Array<{
    longText: string;
    shortText: string;
    types: string[];
  }>;
}

export interface PlacesSearchResponse {
  places: GooglePlace[];
  nextPageToken?: string;
}

// Chicago neighborhoods with approximate center coordinates for searching
const CHICAGO_SEARCH_AREAS = [
  { name: 'River North', lat: 41.8920, lng: -87.6320 },
  { name: 'West Loop', lat: 41.8850, lng: -87.6550 },
  { name: 'Wicker Park', lat: 41.9088, lng: -87.6796 },
  { name: 'Logan Square', lat: 41.9234, lng: -87.7080 },
  { name: 'Lincoln Park', lat: 41.9214, lng: -87.6513 },
  { name: 'Lakeview', lat: 41.9434, lng: -87.6553 },
  { name: 'Boystown', lat: 41.9456, lng: -87.6500 },
  { name: 'Gold Coast', lat: 41.9050, lng: -87.6280 },
  { name: 'Old Town', lat: 41.9110, lng: -87.6360 },
  { name: 'Bucktown', lat: 41.9200, lng: -87.6800 },
  { name: 'Ukrainian Village', lat: 41.8980, lng: -87.6870 },
  { name: 'Pilsen', lat: 41.8560, lng: -87.6560 },
  { name: 'South Loop', lat: 41.8690, lng: -87.6240 },
  { name: 'Streeterville', lat: 41.8930, lng: -87.6180 },
  { name: 'Wrigleyville', lat: 41.9484, lng: -87.6553 },
  { name: 'Andersonville', lat: 41.9800, lng: -87.6680 },
  { name: 'Edgewater', lat: 41.9840, lng: -87.6600 },
  { name: 'Rogers Park', lat: 42.0090, lng: -87.6720 },
  { name: 'Hyde Park', lat: 41.7943, lng: -87.5907 },
  { name: 'Bridgeport', lat: 41.8380, lng: -87.6500 },
];

/**
 * Search for places using Google Places API (New)
 */
async function searchPlaces(
  apiKey: string,
  query: string,
  latitude: number,
  longitude: number,
  radiusMeters: number = 2000
): Promise<GooglePlace[]> {
  const url = 'https://places.googleapis.com/v1/places:searchText';

  const requestBody = {
    textQuery: query,
    locationBias: {
      circle: {
        center: {
          latitude,
          longitude,
        },
        radius: radiusMeters,
      },
    },
    maxResultCount: 20,
    languageCode: 'en',
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.websiteUri,places.nationalPhoneNumber,places.primaryType,places.addressComponents',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[GooglePlaces] API error for "${query}":`, error);
    throw new Error(`Google Places API error: ${response.status}`);
  }

  const data: PlacesSearchResponse = await response.json();
  return data.places || [];
}

/**
 * Determine venue type from Google Place types
 */
function determineVenueType(place: GooglePlace): 'bar' | 'club' | 'latin_dance' | null {
  const types = place.types || [];
  const primaryType = place.primaryType || '';
  const name = place.displayName?.text?.toLowerCase() || '';

  // Check for nightclub indicators
  if (
    types.includes('night_club') ||
    primaryType === 'night_club' ||
    name.includes('nightclub') ||
    name.includes('club') ||
    name.includes('lounge')
  ) {
    // Check for Latin dance specific
    if (
      name.includes('salsa') ||
      name.includes('bachata') ||
      name.includes('latin') ||
      name.includes('cumbia') ||
      name.includes('reggaeton')
    ) {
      return 'latin_dance';
    }
    return 'club';
  }

  // Check for bar
  if (
    types.includes('bar') ||
    primaryType === 'bar' ||
    name.includes('bar') ||
    name.includes('tavern') ||
    name.includes('pub') ||
    name.includes('brewery') ||
    name.includes('taproom')
  ) {
    return 'bar';
  }

  return null;
}

/**
 * Extract neighborhood from address components or match to known neighborhoods
 */
function extractNeighborhood(place: GooglePlace): string {
  // Try to get neighborhood from address components
  if (place.addressComponents) {
    for (const component of place.addressComponents) {
      if (
        component.types.includes('neighborhood') ||
        component.types.includes('sublocality_level_1')
      ) {
        return component.longText;
      }
    }
  }

  // Fall back to matching coordinates to known neighborhoods
  const location = place.location;
  if (!location) return 'Chicago';

  let closestNeighborhood = 'Chicago';
  let minDistance = Infinity;

  for (const area of CHICAGO_SEARCH_AREAS) {
    const distance = Math.sqrt(
      Math.pow(location.latitude - area.lat, 2) +
      Math.pow(location.longitude - area.lng, 2)
    );
    if (distance < minDistance) {
      minDistance = distance;
      closestNeighborhood = area.name;
    }
  }

  return closestNeighborhood;
}

export interface ImportedVenue {
  name: string;
  address: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  type: 'bar' | 'club' | 'latin_dance';
  googlePlaceId: string;
  website?: string;
  phoneNumber?: string;
}

/**
 * Import venues from Google Places API for Chicago
 * Searches multiple neighborhoods and deduplicates results
 */
export async function importChicagoVenues(apiKey: string): Promise<{
  venues: ImportedVenue[];
  errors: string[];
  stats: {
    totalSearched: number;
    barsFound: number;
    clubsFound: number;
    latinDanceFound: number;
    duplicatesRemoved: number;
  };
}> {
  const allPlaces = new Map<string, ImportedVenue>();
  const errors: string[] = [];
  let totalSearched = 0;

  const searchQueries = [
    'bars in Chicago',
    'cocktail bars in Chicago',
    'nightclubs in Chicago',
    'dance clubs in Chicago',
    'latin dance clubs in Chicago',
    'salsa clubs in Chicago',
    'speakeasy bars in Chicago',
    'rooftop bars in Chicago',
    'dive bars in Chicago',
    'sports bars in Chicago',
  ];

  // Search each neighborhood with different queries
  for (const area of CHICAGO_SEARCH_AREAS) {
    for (const baseQuery of ['bar', 'nightclub']) {
      const query = `${baseQuery} near ${area.name} Chicago`;

      try {
        console.log(`[GooglePlaces] Searching: ${query}`);
        const places = await searchPlaces(apiKey, query, area.lat, area.lng, 1500);
        totalSearched += places.length;

        for (const place of places) {
          // Skip if we already have this place
          if (allPlaces.has(place.id)) continue;

          const venueType = determineVenueType(place);
          if (!venueType) continue; // Skip non-bar/club places

          const venue: ImportedVenue = {
            name: place.displayName?.text || 'Unknown',
            address: place.formattedAddress || '',
            neighborhood: extractNeighborhood(place),
            latitude: place.location?.latitude || 0,
            longitude: place.location?.longitude || 0,
            type: venueType,
            googlePlaceId: place.id,
            website: place.websiteUri,
            phoneNumber: place.nationalPhoneNumber,
          };

          // Validate coordinates are in Chicago area
          if (
            venue.latitude < 41.6 || venue.latitude > 42.1 ||
            venue.longitude < -88.1 || venue.longitude > -87.5
          ) {
            continue; // Skip places outside Chicago
          }

          allPlaces.set(place.id, venue);
        }

        // Rate limiting - wait 200ms between requests
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        const errorMsg = `Error searching "${query}": ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`[GooglePlaces] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }
  }

  // Also do city-wide searches
  for (const query of searchQueries) {
    try {
      console.log(`[GooglePlaces] Searching: ${query}`);
      // Center of Chicago
      const places = await searchPlaces(apiKey, query, 41.8781, -87.6298, 15000);
      totalSearched += places.length;

      for (const place of places) {
        if (allPlaces.has(place.id)) continue;

        const venueType = determineVenueType(place);
        if (!venueType) continue;

        const venue: ImportedVenue = {
          name: place.displayName?.text || 'Unknown',
          address: place.formattedAddress || '',
          neighborhood: extractNeighborhood(place),
          latitude: place.location?.latitude || 0,
          longitude: place.location?.longitude || 0,
          type: venueType,
          googlePlaceId: place.id,
          website: place.websiteUri,
          phoneNumber: place.nationalPhoneNumber,
        };

        if (
          venue.latitude < 41.6 || venue.latitude > 42.1 ||
          venue.longitude < -88.1 || venue.longitude > -87.5
        ) {
          continue;
        }

        allPlaces.set(place.id, venue);
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      const errorMsg = `Error searching "${query}": ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`[GooglePlaces] ${errorMsg}`);
      errors.push(errorMsg);
    }
  }

  const venues = Array.from(allPlaces.values());

  // Calculate stats
  const stats = {
    totalSearched,
    barsFound: venues.filter(v => v.type === 'bar').length,
    clubsFound: venues.filter(v => v.type === 'club').length,
    latinDanceFound: venues.filter(v => v.type === 'latin_dance').length,
    duplicatesRemoved: totalSearched - venues.length,
  };

  console.log(`[GooglePlaces] Import complete:`, stats);

  return { venues, errors, stats };
}
