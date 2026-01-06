/**
 * Provider Registry
 *
 * Central place to get the active busyness provider.
 * Makes it easy to swap between MockProvider and real providers (BestTime, Google Places, etc.)
 */

import { BusynessProvider } from './types';
import { MockProvider } from './mock';

/**
 * Get the active busyness provider based on environment configuration
 *
 * To switch providers, set BUSYNESS_PROVIDER environment variable:
 * - "mock" (default): Use MockProvider for testing
 * - "besttime": Use BestTime API (implementation needed)
 * - "google": Use Google Places API (implementation needed)
 */
export function getProvider(): BusynessProvider {
  const providerName = process.env.BUSYNESS_PROVIDER || 'mock';

  switch (providerName.toLowerCase()) {
    case 'mock':
      return new MockProvider();

    // Future providers can be added here:
    // case 'besttime':
    //   return new BestTimeProvider();
    // case 'google':
    //   return new GooglePlacesProvider();

    default:
      console.warn(
        `Unknown provider "${providerName}", falling back to MockProvider`
      );
      return new MockProvider();
  }
}

/**
 * Export types for use in other modules
 */
export type { BusynessProvider, BusynessReading, BusynessForecast } from './types';
export { MockProvider } from './mock';
