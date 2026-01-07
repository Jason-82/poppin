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
      style={{ background: '#0a0a0f' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
        url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
      />
      <MapRecenter center={center} />
      {venues.map(venue => (
        <VenueMarker key={venue.id} venue={venue} />
      ))}
    </MapContainer>
  );
}
