'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import VenueMarker from './VenueMarker';
import { Venue } from '@/lib/api';
import 'leaflet/dist/leaflet.css';

interface MapViewProps {
  venues: Venue[];
  center?: [number, number];
  zoom?: number;
}

// Component to recenter map when venues change
function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center);
  }, [center, map]);

  return null;
}

export default function MapView({ venues, center = [41.8781, -87.6298], zoom = 13 }: MapViewProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-900">
        <p className="text-zinc-400">Loading map...</p>
      </div>
    );
  }

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom={true}
      className="w-full h-full z-0"
      style={{ background: '#18181b' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapRecenter center={center} />
      {venues.map(venue => (
        <VenueMarker key={venue.id} venue={venue} />
      ))}
    </MapContainer>
  );
}
