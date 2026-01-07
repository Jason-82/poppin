'use client';

import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import { DivIcon } from 'leaflet';
import { Venue } from '@/lib/api';
import Link from 'next/link';
import BusynessBadge from '@/components/venue/BusynessBadge';

interface VenueMarkerProps {
  venue: Venue;
}

// SVG icons for different venue types
const VENUE_ICONS = {
  bar: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
    <path d="M7.5 7.5h9L12 13.5 7.5 7.5zM11 15v5H9v2h6v-2h-2v-5l6-9H5l6 9z"/>
  </svg>`, // Martini glass
  club: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
  </svg>`, // Music note
  latin_dance: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
    <path d="M14 6c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2zm-2 4c-1.66 0-3 1.34-3 3v1h2v7h2v-7h2v-1c0-1.66-1.34-3-3-3zm6 0c-.55 0-1 .45-1 1v8h2v-8c0-.55-.45-1-1-1zm-12 0c-.55 0-1 .45-1 1v8h2v-8c0-.55-.45-1-1-1z"/>
  </svg>`, // Dancing figure
};

// Color scheme based on busyness - nightlife friendly!
function getMarkerColor(level: number, confidence: number): { bg: string; border: string; label: string } {
  // Handle special cases first
  if (level === -1) {
    return { bg: '#3f3f46', border: '#27272a', label: 'Closed' }; // zinc-700/800
  }

  if (confidence < 0.2) {
    return { bg: '#71717a', border: '#52525b', label: 'No Data' }; // zinc-500/600
  }

  if (level <= 25) {
    return { bg: '#3b82f6', border: '#2563eb', label: 'Quiet' }; // blue-500/600 - chill vibes
  }

  if (level <= 50) {
    return { bg: '#22c55e', border: '#16a34a', label: 'Warming Up' }; // green-500/600 - getting good
  }

  if (level <= 75) {
    return { bg: '#eab308', border: '#ca8a04', label: 'Busy' }; // yellow-500/600 - poppin!
  }

  // 76-100: Packed - peak vibes!
  return { bg: '#a855f7', border: '#9333ea', label: 'Packed' }; // purple-500/600
}

export default function VenueMarker({ venue }: VenueMarkerProps) {
  const level = venue.currentBusyness.level;
  const confidence = venue.currentBusyness.confidence;
  const { bg, border } = getMarkerColor(level, confidence);

  // Get icon for venue type
  const icon = VENUE_ICONS[venue.type] || VENUE_ICONS.bar;

  // Create custom marker icon with venue type icon inside
  const customIcon = new DivIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${bg};
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 3px solid ${border};
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
      ">
        ${icon}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  // Get venue type label
  const typeLabel = venue.type === 'latin_dance' ? 'Latin Dance' :
                    venue.type === 'club' ? 'Club' : 'Bar';

  return (
    <Marker
      position={[venue.latitude, venue.longitude]}
      icon={customIcon}
    >
      <Popup>
        <div className="text-black min-w-[200px]">
          <h3 className="font-bold text-base mb-1">{venue.name}</h3>
          <p className="text-xs text-purple-600 font-medium mb-2">{typeLabel}</p>
          <div className="mb-2">
            <BusynessBadge
              level={venue.currentBusyness.level}
              confidence={venue.currentBusyness.confidence}
              size="sm"
            />
          </div>
          <p className="text-xs text-gray-600 mb-2">{venue.address}</p>
          {venue.neighborhood && (
            <p className="text-xs text-gray-500 mb-2">{venue.neighborhood}</p>
          )}
          <Link
            href={`/venue/${venue.id}`}
            className="text-purple-600 hover:text-purple-700 text-sm font-medium"
          >
            View Details →
          </Link>
        </div>
      </Popup>
    </Marker>
  );
}
