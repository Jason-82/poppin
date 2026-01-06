'use client';

import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import { Icon, DivIcon } from 'leaflet';
import { Venue } from '@/lib/api';
import Link from 'next/link';
import BusynessBadge from '@/components/venue/BusynessBadge';

interface VenueMarkerProps {
  venue: Venue;
}

export default function VenueMarker({ venue }: VenueMarkerProps) {
  // Determine marker color based on busyness level and confidence
  let markerColor: string;
  const level = venue.currentBusyness.level;
  const confidence = venue.currentBusyness.confidence;

  // PRIVACY FIX: Show grey marker for low confidence data
  if (confidence < 0.2) {
    markerColor = '#71717a'; // zinc-500 (grey) for limited data
  } else if (level <= 25) {
    markerColor = '#16a34a'; // green-600
  } else if (level <= 50) {
    markerColor = '#eab308'; // yellow-500
  } else if (level <= 75) {
    markerColor = '#f97316'; // orange-500
  } else {
    markerColor = '#dc2626'; // red-600
  }

  // Create custom marker icon using DivIcon
  const customIcon = new DivIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${markerColor};
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  return (
    <Marker
      position={[venue.latitude, venue.longitude]}
      icon={customIcon}
    >
      <Popup>
        <div className="text-black min-w-[200px]">
          <h3 className="font-bold text-base mb-1">{venue.name}</h3>
          <div className="mb-2">
            <BusynessBadge
              level={venue.currentBusyness.level}
              confidence={venue.currentBusyness.confidence}
              size="sm"
            />
          </div>
          <p className="text-xs text-gray-600 mb-2">{venue.address}</p>
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
