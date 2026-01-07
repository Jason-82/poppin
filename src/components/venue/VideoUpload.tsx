'use client';

import React, { useState, useRef } from 'react';
import Button from '@/components/ui/Button';

interface VideoUploadProps {
  venueId: string;
  venueName: string;
  onSuccess?: () => void;
}

export default function VideoUpload({
  venueId,
  venueName,
  onSuccess,
}: VideoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  // Request GPS permission and get coordinates
  const requestGPS = async () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser');
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          });
        }
      );

      setGpsCoords({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
      setGpsError(null);
    } catch (err) {
      if (err instanceof GeolocationPositionError) {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError('GPS permission denied. Video will be uploaded without location verification.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGpsError('GPS position unavailable. Video will be uploaded without location verification.');
        } else {
          setGpsError('GPS timeout. Video will be uploaded without location verification.');
        }
      } else {
        setGpsError('Could not get GPS location. Video will be uploaded without location verification.');
      }
    }
  };

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset states
    setError(null);
    setSuccess(false);
    setPreviewUrl(null);
    setVideoDuration(0);

    // Validate file type
    if (!file.type.startsWith('video/')) {
      setError('Please select a video file');
      return;
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      setError('Video file is too large. Maximum size is 50MB');
      return;
    }

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setSelectedFile(file);

    // Get video duration
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      const duration = Math.round(video.duration);
      setVideoDuration(duration);

      // Validate duration (max 30 seconds)
      if (duration > 30) {
        setError(`Video is too long (${duration}s). Maximum length is 30 seconds`);
        setPreviewUrl(null);
        setSelectedFile(null);
        URL.revokeObjectURL(url);
      }
    };
    video.src = url;

    // Request GPS location
    await requestGPS();
  };

  // Handle upload
  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a video file');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Create form data
      const formData = new FormData();
      formData.append('video', selectedFile);

      // Add GPS coordinates if available
      if (gpsCoords) {
        formData.append('latitude', gpsCoords.lat.toString());
        formData.append('longitude', gpsCoords.lng.toString());
      }

      // Simulate upload progress (since we can't track actual progress easily)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Upload video
      const response = await fetch(`/api/venues/${venueId}/video`, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload video');
      }

      const data = await response.json();

      // Success!
      setSuccess(true);
      setPreviewUrl(null);
      setSelectedFile(null);
      setVideoDuration(0);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Call success callback
      onSuccess?.();

      // Auto-dismiss success message after 3 seconds
      setTimeout(() => {
        setSuccess(false);
        setUploadProgress(0);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload video');
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  // Cancel preview
  const handleCancel = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setSelectedFile(null);
    setVideoDuration(0);
    setError(null);
    setGpsError(null);
    setGpsCoords(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload button */}
      {!previewUrl && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
            id="video-upload"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="primary"
            disabled={isUploading}
          >
            Share Live Video
          </Button>
          <p className="text-xs text-zinc-500 mt-2">
            Max 30 seconds, 50MB. GPS verification encouraged.
          </p>
        </div>
      )}

      {/* Preview and upload */}
      {previewUrl && selectedFile && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">Preview Video</h3>

          {/* Video preview */}
          <video
            ref={videoPreviewRef}
            src={previewUrl}
            controls
            className="w-full max-h-64 rounded-lg bg-black mb-3"
          />

          {/* Video info */}
          <div className="text-sm text-zinc-400 mb-3 space-y-1">
            <p>Duration: {videoDuration} seconds</p>
            <p>Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
            {gpsCoords && (
              <p className="text-green-400">GPS verified (within 500m)</p>
            )}
            {gpsError && (
              <p className="text-yellow-400">{gpsError}</p>
            )}
          </div>

          {/* Upload progress */}
          {isUploading && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-sm text-zinc-400 mb-1">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={handleCancel}
              disabled={isUploading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUpload}
              disabled={isUploading || !!error}
              className="flex-1"
            >
              {isUploading ? 'Uploading...' : 'Upload Video'}
            </Button>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="p-3 bg-green-900/20 border border-green-800 rounded-lg text-green-400 text-sm">
          Video uploaded successfully! It will expire in 4 hours.
        </div>
      )}
    </div>
  );
}
