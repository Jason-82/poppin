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

// Icons for different venue types - using HTML for club to make it white
const VENUE_ICONS: Record<string, { icon: string; style?: string }> = {
  bar: { icon: '🍸' },
  club: { icon: '♫', style: 'color: white; font-weight: bold; font-size: 20px;' },  // White music notes
  latin_dance: { icon: '💃' },
};

// Color scheme based on busyness - nightlife friendly!
function getMarkerStyle(level: number, confidence: number): {
  bg: string;
  border: string;
  label: string;
  animation: string;
} {
  // Handle special cases first
  if (level === -1) {
    return { bg: '#3f3f46', border: '#27272a', label: 'Closed', animation: 'none' };
  }

  if (confidence < 0.2) {
    return { bg: '#71717a', border: '#52525b', label: 'No Data', animation: 'none' };
  }

  if (level <= 25) {
    return { bg: '#3b82f6', border: '#2563eb', label: 'Quiet', animation: 'none' };
  }

  if (level <= 50) {
    return { bg: '#22c55e', border: '#16a34a', label: 'Warming Up', animation: 'none' };
  }

  if (level <= 75) {
    // Busy - slow pulse
    return { bg: '#eab308', border: '#ca8a04', label: 'Busy', animation: 'pulse-slow 2s ease-in-out infinite' };
  }

  // 76-100: Packed - fast pulse!
  return { bg: '#a855f7', border: '#9333ea', label: 'Packed', animation: 'pulse-fast 0.8s ease-in-out infinite' };
}

// CSS for pulse animations - injected once
const pulseStyles = `
  @keyframes pulse-slow {
    0%, 100% { transform: scale(1); box-shadow: 0 2px 6px rgba(234, 179, 8, 0.4); }
    50% { transform: scale(1.15); box-shadow: 0 4px 12px rgba(234, 179, 8, 0.7); }
  }
  @keyframes pulse-fast {
    0%, 100% { transform: scale(1); box-shadow: 0 2px 6px rgba(168, 85, 247, 0.5); }
    50% { transform: scale(1.2); box-shadow: 0 6px 16px rgba(168, 85, 247, 0.9); }
  }
`;

export default function VenueMarker({ venue }: VenueMarkerProps) {
  const level = venue.currentBusyness.level;
  const confidence = venue.currentBusyness.confidence;
  const { bg, border, animation } = getMarkerStyle(level, confidence);

  // Get icon config for venue type
  const iconConfig = VENUE_ICONS[venue.type] || VENUE_ICONS.bar;
  const iconStyle = iconConfig.style || '';

  // Check if venue has Latin event tonight
  const hasLatinTonight = venue.hasLatinTonight;

  // Event badge indicator (shown as small badge on top-right)
  const eventBadge = hasLatinTonight
    ? `<div style="
        position: absolute;
        top: -4px;
        right: -4px;
        background: #ec4899;
        border-radius: 50%;
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        border: 2px solid white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      ">💃</div>`
    : '';

  // Create custom marker icon with emoji and animations
  const customIcon = new DivIcon({
    className: 'custom-marker',
    html: `
      <style>${pulseStyles}</style>
      <div style="position: relative;">
        <div style="
          background-color: ${bg};
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 3px solid ${border};
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          animation: ${animation};
        ">
          <span style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5)); ${iconStyle}">${iconConfig.icon}</span>
        </div>
        ${eventBadge}
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
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
          {/* Show event tonight badge */}
          {venue.eventTonight && (
            <div className="mb-2 bg-pink-100 text-pink-800 px-2 py-1 rounded text-xs font-medium">
              🔥 Tonight: {venue.eventTonight.name}
              <br />
              <span className="text-pink-600">{venue.eventTonight.startTime} - {venue.eventTonight.endTime}</span>
            </div>
          )}
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
