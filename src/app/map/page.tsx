'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import FilterBar from '@/components/map/FilterBar';
import VenueCard from '@/components/venue/VenueCard';
import Button from '@/components/ui/Button';
import { getVenues, Venue } from '@/lib/api';

// Dynamically import MapView with ssr disabled for Leaflet
const MapView = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-zinc-900">
      <p className="text-zinc-400">Loading map...</p>
    </div>
  ),
});

export default function MapPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [filteredVenues, setFilteredVenues] = useState<Venue[]>([]);
  const [selectedType, setSelectedType] = useState('all');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('all');
  const [latinTonightOnly, setLatinTonightOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract unique neighborhoods from venues
  const neighborhoods = React.useMemo(() => {
    const uniqueNeighborhoods = [...new Set(venues.map(v => v.neighborhood).filter(Boolean))] as string[];
    return uniqueNeighborhoods.sort();
  }, [venues]);

  // Fetch venues on mount
  useEffect(() => {
    const fetchVenues = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getVenues({
          // Chicago metro area bounding box (includes suburbs)
          neLat: 42.15,
          neLng: -87.52,
          swLat: 41.60,
          swLng: -88.30,
          limit: 500,
        });
        setVenues(data.venues);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load venues');
      } finally {
        setIsLoading(false);
      }
    };

    fetchVenues();
  }, []);

  // Filter venues by type, neighborhood, and Latin tonight
  useEffect(() => {
    let filtered = venues;

    if (selectedType !== 'all') {
      filtered = filtered.filter(v => v.type === selectedType);
    }

    if (selectedNeighborhood !== 'all') {
      filtered = filtered.filter(v => v.neighborhood === selectedNeighborhood);
    }

    if (latinTonightOnly) {
      filtered = filtered.filter(v => v.hasLatinTonight);
    }

    setFilteredVenues(filtered);
  }, [venues, selectedType, selectedNeighborhood, latinTonightOnly]);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Header />

      {/* Controls */}
      <div className="bg-zinc-900 border-b border-zinc-800 p-4">
        <div className="container mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <FilterBar
            selectedType={selectedType}
            onTypeChange={setSelectedType}
            selectedNeighborhood={selectedNeighborhood}
            onNeighborhoodChange={setSelectedNeighborhood}
            neighborhoods={neighborhoods}
            latinTonightOnly={latinTonightOnly}
            onLatinTonightChange={setLatinTonightOnly}
          />

          <div className="flex gap-2">
            <Button
              variant={viewMode === 'map' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('map')}
            >
              Map
            </Button>
            <Button
              variant={viewMode === 'list' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              List
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-zinc-400">Loading venues...</p>
          </div>
        ) : error ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </div>
          </div>
        ) : viewMode === 'map' ? (
          <div className="w-full h-[calc(100vh-180px)]">
            <MapView venues={filteredVenues} />
          </div>
        ) : (
          <div className="container mx-auto p-4">
            {filteredVenues.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-zinc-400">No venues found.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredVenues.map(venue => (
                  <VenueCard key={venue.id} venue={venue} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Venue count */}
      <div className="bg-zinc-900 border-t border-zinc-800 px-4 py-2">
        <div className="container mx-auto">
          <p className="text-sm text-zinc-400">
            Showing {filteredVenues.length} of {venues.length} venues
          </p>
        </div>
      </div>
    </div>
  );
}
