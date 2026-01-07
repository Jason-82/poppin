'use client';

import React from 'react';
import Button from '@/components/ui/Button';

interface FilterBarProps {
  selectedType: string;
  onTypeChange: (type: string) => void;
  selectedNeighborhood: string;
  onNeighborhoodChange: (neighborhood: string) => void;
  neighborhoods: string[];
}

const VENUE_TYPES = [
  { value: 'all', label: 'All' },
  { value: 'bar', label: 'Bars' },
  { value: 'club', label: 'Clubs' },
  { value: 'latin_dance', label: 'Latin Dance' },
];

export default function FilterBar({
  selectedType,
  onTypeChange,
  selectedNeighborhood,
  onNeighborhoodChange,
  neighborhoods,
}: FilterBarProps) {
  return (
    <div className="flex gap-4 flex-wrap items-center">
      {/* Type filter buttons */}
      <div className="flex gap-2 flex-wrap">
        {VENUE_TYPES.map(type => (
          <Button
            key={type.value}
            variant={selectedType === type.value ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => onTypeChange(type.value)}
          >
            {type.label}
          </Button>
        ))}
      </div>

      {/* Neighborhood dropdown */}
      <select
        value={selectedNeighborhood}
        onChange={(e) => onNeighborhoodChange(e.target.value)}
        className="bg-zinc-800 text-white text-sm px-3 py-1.5 rounded-lg border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
      >
        <option value="all">All Neighborhoods</option>
        {neighborhoods.map(neighborhood => (
          <option key={neighborhood} value={neighborhood}>
            {neighborhood}
          </option>
        ))}
      </select>
    </div>
  );
}
