/**
 * Provider Registry
 *
 * Central place to get the active busyness provider.
 * Makes it easy to swap between MockProvider and real providers (BestTime, Google Places, etc.)
 */

import { BusynessProvider } from './types';
import { MockProvider } from './mock';
import { BestTimeProvider } from './besttime';
import { GooglePlacesProvider } from './google-places';

/**
 * Get the active busyness provider based on environment configuration
 *
 * To switch providers, set BUSYNESS_PROVIDER environment variable:
 * - "mock" (default): Use MockProvider for testing
 * - "besttime": Use BestTime API
 * - "google": Use Google Places API for open/closed + time-based estimates
 */
export function getProvider(): BusynessProvider {
  const providerName = process.env.BUSYNESS_PROVIDER || 'mock';

  switch (providerName.toLowerCase()) {
    case 'mock':
      return new MockProvider();

    case 'besttime': {
      const provider = new BestTimeProvider();
      // Fall back to mock if API key is not configured
      if (!process.env.BESTTIME_API_KEY && !process.env.BUSYNESS_PROVIDER_API_KEY) {
        console.warn(
          'BESTTIME_API_KEY not configured, falling back to MockProvider'
        );
        return new MockProvider();
      }
      return provider;
    }

    case 'google': {
      const provider = new GooglePlacesProvider();
      // Fall back to mock if API key is not configured
      if (!process.env.GOOGLE_PLACES_API_KEY) {
        console.warn(
          'GOOGLE_PLACES_API_KEY not configured, falling back to MockProvider'
        );
        return new MockProvider();
      }
      return provider;
    }

    default:
      console.warn(
        `Unknown provider "${providerName}", falling back to MockProvider`
      );
      return new MockProvider();
  }
}

/**
 * Export types and providers for use in other modules
 */
export type { BusynessProvider, BusynessReading, BusynessForecast } from './types';
export { MockProvider } from './mock';
export { BestTimeProvider } from './besttime';
export { GooglePlacesProvider } from './google-places';
