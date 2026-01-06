'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import BusynessBadge from '@/components/venue/BusynessBadge';
import TrendArrow from '@/components/venue/TrendArrow';
import { getFavorites, removeFavorite } from '@/lib/favorites';
import { getVenue, VenueDetail } from '@/lib/api';

export default function FavoritesPage() {
  const router = useRouter();
  const [favoriteVenues, setFavoriteVenues] = useState<VenueDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const favoriteIds = getFavorites();

        if (favoriteIds.length === 0) {
          setFavoriteVenues([]);
          setIsLoading(false);
          return;
        }

        // Fetch all favorite venues
        const venuePromises = favoriteIds.map(id => getVenue(id));
        const venues = await Promise.all(venuePromises);

        setFavoriteVenues(venues);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load favorites');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFavorites();
  }, []);

  const handleRemoveFavorite = (venueId: string) => {
    removeFavorite(venueId);
    setFavoriteVenues(prev => prev.filter(v => v.id !== venueId));
  };

  const handleVenueClick = (venueId: string) => {
    router.push(`/venue/${venueId}`);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Your Favorites</h1>
          <p className="text-zinc-400">
            Venues you've starred for quick access
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-zinc-400">Loading favorites...</p>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </div>
          </div>
        ) : favoriteVenues.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-zinc-400 mb-4">
              You haven't favorited any venues yet.
            </p>
            <Button onClick={() => router.push('/map')}>
              Explore Venues
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {favoriteVenues.map(venue => (
              <Card
                key={venue.id}
                className="relative hover:bg-zinc-800 transition-colors"
              >
                <button
                  onClick={() => handleVenueClick(venue.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-1">
                        {venue.name}
                      </h3>
                      <p className="text-sm text-zinc-500">{venue.address}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <BusynessBadge level={venue.currentBusyness.level} />
                    <TrendArrow trend={venue.currentBusyness.trend} showText />
                  </div>

                  <p className="text-xs text-zinc-500">
                    Last updated:{' '}
                    {new Date(venue.currentBusyness.lastUpdated).toLocaleTimeString()}
                  </p>
                </button>

                <div className="mt-4 pt-4 border-t border-zinc-800">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFavorite(venue.id);
                    }}
                    className="w-full"
                  >
                    Remove from Favorites
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
