// API client functions for calling backend endpoints

export interface Venue {
  id: string;
  name: string;
  address: string;
  neighborhood?: string;
  latitude: number;
  longitude: number;
  type: 'bar' | 'club' | 'latin_dance';
  description?: string;
  phoneNumber?: string;
  website?: string;
  currentBusyness: {
    level: number; // 0-100
    confidence: number; // 0-1
    trend: 'up' | 'down' | 'stable';
    lastUpdated: string;
  };
  // Event info
  hasEventTonight?: boolean;
  hasLatinTonight?: boolean;
  eventTonight?: {
    name: string;
    type: string;
    startTime: string;
    endTime: string;
  } | null;
}

export interface VenueDetail extends Venue {
  recentReports: CrowdReport[];
}

export interface CrowdReport {
  level: 'dead' | 'warm' | 'busy' | 'packed';
  tags: string[];
  createdAt: string;
  timeAgo: string;
}

export interface VenuesResponse {
  venues: Venue[];
  total: number;
}

// Verify passcode
export async function verifyPasscode(passcode: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const response = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode }),
  });

  return response.json();
}

// Get all venues within bounding box
export async function getVenues(params?: {
  neLat?: number;
  neLng?: number;
  swLat?: number;
  swLng?: number;
  type?: string;
  neighborhood?: string;
  eventTonight?: string;  // 'true' for any event, 'latin' for Latin dance nights
  limit?: number;
}): Promise<VenuesResponse> {
  const queryParams = new URLSearchParams();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, value.toString());
      }
    });
  }

  const response = await fetch(`/api/venues?${queryParams}`);

  if (!response.ok) {
    throw new Error('Failed to fetch venues');
  }

  return response.json();
}

// Get single venue by ID
export async function getVenue(id: string): Promise<VenueDetail> {
  const response = await fetch(`/api/venues/${id}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Venue not found');
    }
    throw new Error('Failed to fetch venue');
  }

  return response.json();
}

// Points response from gamification
export interface PointsResponse {
  awarded: number;
  total: number;
  newBadges: string[];
}

// Submit crowd report
export async function submitReport(
  venueId: string,
  level: 'dead' | 'warm' | 'busy' | 'packed',
  tags?: string[]
): Promise<{ success: boolean; reportId: string; message: string; points?: PointsResponse }> {
  const response = await fetch(`/api/venues/${venueId}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level, tags }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to submit report');
  }

  return response.json();
}

// Get venue busyness history
export async function getVenueBusyness(venueId: string, hours: number = 24) {
  const response = await fetch(`/api/venues/${venueId}/busyness?hours=${hours}`);

  if (!response.ok) {
    throw new Error('Failed to fetch busyness data');
  }

  return response.json();
}

// Video-related types and functions

export interface VenueVideo {
  id: string;
  videoUrl: string;
  thumbnailUrl?: string | null;
  createdAt: string;
  expiresAt: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface VenueVideosResponse {
  videos: VenueVideo[];
  count: number;
}

// Get videos for a venue
export async function getVenueVideos(venueId: string): Promise<VenueVideosResponse> {
  const response = await fetch(`/api/venues/${venueId}/video`);

  if (!response.ok) {
    throw new Error('Failed to fetch videos');
  }

  return response.json();
}

// Upload video for a venue
export async function uploadVenueVideo(
  venueId: string,
  videoFile: File,
  gpsCoords?: { latitude: number; longitude: number }
): Promise<{ success: boolean; videoId: string; expiresAt: string; gpsVerified: boolean; message: string; points?: PointsResponse }> {
  const formData = new FormData();
  formData.append('video', videoFile);

  if (gpsCoords) {
    formData.append('latitude', gpsCoords.latitude.toString());
    formData.append('longitude', gpsCoords.longitude.toString());
  }

  const response = await fetch(`/api/venues/${venueId}/video`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload video');
  }

  return response.json();
}

// Delete a video
export async function deleteVenueVideo(
  venueId: string,
  videoId: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`/api/venues/${venueId}/video`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete video');
  }

  return response.json();
}
