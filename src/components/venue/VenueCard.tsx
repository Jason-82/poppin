'use client';

import React from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import BusynessBadge from './BusynessBadge';
import TrendArrow from './TrendArrow';
import { Venue } from '@/lib/api';

interface VenueCardProps {
  venue: Venue;
}

export default function VenueCard({ venue }: VenueCardProps) {
  const typeLabels = {
    bar: 'Bar',
    club: 'Club',
    latin_dance: 'Latin Dance',
  };

  return (
    <Link href={`/venue/${venue.id}`}>
      <Card className="hover:bg-zinc-800 transition-colors">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">{venue.name}</h3>
            <p className="text-sm text-zinc-400 mt-1">{typeLabels[venue.type]}</p>
            <p className="text-sm text-zinc-500 mt-1">{venue.address}</p>
          </div>
          <div className="flex flex-col items-end gap-2 ml-4">
            <BusynessBadge
              level={venue.currentBusyness.level}
              confidence={venue.currentBusyness.confidence}
            />
            <TrendArrow trend={venue.currentBusyness.trend} />
          </div>
        </div>
      </Card>
    </Link>
  );
}
