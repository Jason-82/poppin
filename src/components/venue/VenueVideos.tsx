'use client';

import React, { useState, useEffect, useRef } from 'react';
import Button from '@/components/ui/Button';

interface Video {
  id: string;
  videoUrl: string;
  thumbnailUrl?: string | null;
  createdAt: string;
  expiresAt: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface VenueVideosProps {
  venueId: string;
  onRefresh?: () => void;
}

export default function VenueVideos({ venueId, onRefresh }: VenueVideosProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const videoPlayerRef = useRef<HTMLVideoElement>(null);

  // Fetch videos
  const fetchVideos = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/venues/${venueId}/video`);

      if (!response.ok) {
        throw new Error('Failed to fetch videos');
      }

      const data = await response.json();
      setVideos(data.videos || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, [venueId]);

  // Format time ago
  const getTimeAgo = (dateString: string): string => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  // Format time until expiration
  const getExpiresIn = (dateString: string): string => {
    const now = new Date();
    const expiry = new Date(dateString);
    const diffMs = expiry.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins <= 0) return 'Expired';
    if (diffMins < 60) return `Expires in ${diffMins} min${diffMins > 1 ? 's' : ''}`;

    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;

    if (diffHours < 4) {
      return `Expires in ${diffHours}h ${remainingMins}m`;
    }

    return `Expires in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  };

  // Play video
  const handlePlayVideo = (video: Video) => {
    setSelectedVideo(video);
  };

  // Close video player
  const handleClosePlayer = () => {
    setSelectedVideo(null);
    if (videoPlayerRef.current) {
      videoPlayerRef.current.pause();
    }
  };

  // Delete video
  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm('Are you sure you want to delete this video?')) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/venues/${venueId}/video`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete video');
      }

      // Refresh video list
      await fetchVideos();
      setSelectedVideo(null);
      onRefresh?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete video');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-400">Loading videos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-400 mb-2">{error}</p>
        <Button variant="secondary" onClick={fetchVideos} size="sm">
          Retry
        </Button>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-12 bg-zinc-900/50 border border-zinc-800 rounded-lg">
        <p className="text-zinc-400 mb-1">No videos yet</p>
        <p className="text-sm text-zinc-500">Be the first to share the vibe!</p>
      </div>
    );
  }

  return (
    <div>
      {/* Video count badge */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">
          Live Videos ({videos.length})
        </h3>
        <Button variant="ghost" onClick={fetchVideos} size="sm">
          Refresh
        </Button>
      </div>

      {/* Video list - horizontal scroll */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {videos.map((video) => (
            <div
              key={video.id}
              className="flex-shrink-0 w-48 cursor-pointer group"
              onClick={() => handlePlayVideo(video)}
            >
              {/* Video thumbnail/preview */}
              <div className="relative bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden mb-2 aspect-[9/16] group-hover:border-purple-500 transition-colors">
                <video
                  src={video.videoUrl}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
                {/* Play overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                  <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-white ml-1"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Video info */}
              <div className="text-xs space-y-1">
                <p className="text-zinc-400">{getTimeAgo(video.createdAt)}</p>
                <p className="text-zinc-500">{getExpiresIn(video.expiresAt)}</p>
                {video.latitude && video.longitude && (
                  <p className="text-green-500">GPS verified</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Full screen video player modal */}
      {selectedVideo && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={handleClosePlayer}
        >
          <div
            className="relative max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleClosePlayer}
              className="absolute -top-12 right-0 text-white hover:text-zinc-300"
            >
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            {/* Video player */}
            <video
              ref={videoPlayerRef}
              src={selectedVideo.videoUrl}
              controls
              autoPlay
              className="w-full rounded-lg bg-black"
            />

            {/* Video info */}
            <div className="mt-4 text-white">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm text-zinc-400">
                    {getTimeAgo(selectedVideo.createdAt)}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {getExpiresIn(selectedVideo.expiresAt)}
                  </p>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDeleteVideo(selectedVideo.id)}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete My Video'}
                </Button>
              </div>
              {selectedVideo.latitude && selectedVideo.longitude && (
                <p className="text-xs text-green-400">GPS verified location</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
