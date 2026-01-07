'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import BusynessBadge from '@/components/venue/BusynessBadge';
import TrendArrow from '@/components/venue/TrendArrow';
import ConfidenceBadge from '@/components/venue/ConfidenceBadge';
import FavoriteButton from '@/components/venue/FavoriteButton';
import ReportVibeModal from '@/components/venue/ReportVibeModal';
import VideoUpload from '@/components/venue/VideoUpload';
import VenueVideos from '@/components/venue/VenueVideos';
import { getVenue, VenueDetail } from '@/lib/api';

export default function VenuePage() {
  const params = useParams();
  const router = useRouter();
  const venueId = params.id as string;

  const [venue, setVenue] = useState<VenueDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [videoRefreshKey, setVideoRefreshKey] = useState(0);

  useEffect(() => {
    const fetchVenue = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getVenue(venueId);
        setVenue(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load venue');
      } finally {
        setIsLoading(false);
      }
    };

    if (venueId) {
      fetchVenue();
    }
  }, [venueId]);

  const handleReportSuccess = () => {
    // Refetch venue data after successful report
    getVenue(venueId).then(setVenue);
  };

  const handleVideoUploadSuccess = () => {
    // Trigger video list refresh
    setVideoRefreshKey((prev) => prev + 1);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-400">Loading venue...</p>
        </div>
      </div>
    );
  }

  if (error || !venue) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-400 mb-4">{error || 'Venue not found'}</p>
            <Button onClick={() => router.push('/map')}>Back to Map</Button>
          </div>
        </div>
      </div>
    );
  }

  const typeLabels = {
    bar: 'Bar',
    club: 'Club',
    latin_dance: 'Latin Dance',
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Header />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-6"
        >
          ← Back
        </Button>

        {/* Venue Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">{venue.name}</h1>
              <p className="text-lg text-zinc-400">{typeLabels[venue.type]}</p>
            </div>
            <FavoriteButton venueId={venue.id} />
          </div>

          <p className="text-zinc-400 mb-2">{venue.address}</p>

          {venue.phoneNumber && (
            <p className="text-zinc-400 mb-2">
              <a href={`tel:${venue.phoneNumber}`} className="hover:text-purple-400">
                {venue.phoneNumber}
              </a>
            </p>
          )}

          {venue.website && (
            <p className="text-zinc-400 mb-2">
              <a
                href={venue.website}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-purple-400"
              >
                Visit Website →
              </a>
            </p>
          )}
        </div>

        {/* Current Busyness */}
        <Card className="mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Current Busyness</h2>

          <div className="flex items-center gap-4 mb-4">
            <BusynessBadge
              level={venue.currentBusyness.level}
              confidence={venue.currentBusyness.confidence}
              size="lg"
            />
            <TrendArrow trend={venue.currentBusyness.trend} showText />
          </div>

          <div className="space-y-2 text-sm text-zinc-400">
            <p>
              <ConfidenceBadge confidence={venue.currentBusyness.confidence} />
            </p>
            <p>
              Last updated:{' '}
              {new Date(venue.currentBusyness.lastUpdated).toLocaleString()}
            </p>
          </div>

          <div className="mt-6">
            <Button
              variant="primary"
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-auto"
            >
              Report Vibe
            </Button>
          </div>
        </Card>

        {/* Live Videos Section */}
        <Card className="mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Live Videos</h2>

          {/* Video Upload */}
          <div className="mb-6">
            <VideoUpload
              venueId={venue.id}
              venueName={venue.name}
              onSuccess={handleVideoUploadSuccess}
            />
          </div>

          {/* Video Display */}
          <VenueVideos
            key={videoRefreshKey}
            venueId={venue.id}
            onRefresh={handleVideoUploadSuccess}
          />
        </Card>

        {/* Recent Reports */}
        {venue.recentReports && venue.recentReports.length > 0 && (
          <Card>
            <h2 className="text-xl font-semibold text-white mb-4">
              Recent Crowd Reports
            </h2>

            <div className="space-y-4">
              {venue.recentReports.slice(0, 5).map((report, index) => (
                <div
                  key={index}
                  className="border-b border-zinc-800 last:border-0 pb-4 last:pb-0"
                >
                  <div className="flex items-center justify-between mb-2">
                    <BusynessBadge
                      level={
                        report.level === 'dead'
                          ? 12
                          : report.level === 'warm'
                          ? 38
                          : report.level === 'busy'
                          ? 63
                          : 88
                      }
                      size="sm"
                    />
                    <span className="text-sm text-zinc-500">{report.timeAgo}</span>
                  </div>

                  {report.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {report.tags.map((tag, tagIndex) => (
                        <span
                          key={tagIndex}
                          className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-300"
                        >
                          {tag.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Description */}
        {venue.description && (
          <Card className="mt-6">
            <h2 className="text-xl font-semibold text-white mb-4">About</h2>
            <p className="text-zinc-400">{venue.description}</p>
          </Card>
        )}
      </div>

      {/* Report Modal */}
      <ReportVibeModal
        venueId={venue.id}
        venueName={venue.name}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleReportSuccess}
      />
    </div>
  );
}
