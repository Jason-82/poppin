// API client functions for calling backend endpoints

export interface Venue {
  id: string;
  name: string;
  address: string;
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

// Submit crowd report
export async function submitReport(
  venueId: string,
  level: 'dead' | 'warm' | 'busy' | 'packed',
  tags?: string[]
): Promise<{ success: boolean; reportId: string; message: string }> {
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
