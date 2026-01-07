/**
 * BestTime Venue ID Cache
 *
 * BestTime uses their own venue IDs, so we need to map our venue IDs to theirs.
 * This cache stores the mapping to avoid repeated API searches.
 *
 * In production, consider using Redis or database storage for persistence.
 * For now, we use an in-memory cache that resets on server restart.
 */

interface VenueIdMapping {
  ourVenueId: string;
  bestTimeVenueId: string;
  cachedAt: Date;
}

class BestTimeVenueCache {
  private cache: Map<string, VenueIdMapping> = new Map();
  private readonly TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  /**
   * Get cached BestTime venue ID for our venue
   */
  get(ourVenueId: string): string | null {
    const mapping = this.cache.get(ourVenueId);

    if (!mapping) {
      return null;
    }

    // Check if cache entry is stale
    const age = Date.now() - mapping.cachedAt.getTime();
    if (age > this.TTL_MS) {
      this.cache.delete(ourVenueId);
      return null;
    }

    return mapping.bestTimeVenueId;
  }

  /**
   * Store BestTime venue ID mapping
   */
  set(ourVenueId: string, bestTimeVenueId: string): void {
    this.cache.set(ourVenueId, {
      ourVenueId,
      bestTimeVenueId,
      cachedAt: new Date(),
    });
  }

  /**
   * Clear a specific venue from cache
   */
  clear(ourVenueId: string): void {
    this.cache.delete(ourVenueId);
  }

  /**
   * Clear all cache entries
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.values()),
    };
  }
}

// Export singleton instance
export const venueCache = new BestTimeVenueCache();
