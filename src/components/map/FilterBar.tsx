'use client';

import React from 'react';
import Button from '@/components/ui/Button';

interface FilterBarProps {
  selectedType: string;
  onTypeChange: (type: string) => void;
  selectedNeighborhood: string;
  onNeighborhoodChange: (neighborhood: string) => void;
  neighborhoods: string[];
  latinTonightOnly: boolean;
  onLatinTonightChange: (enabled: boolean) => void;
  selectedBusyness: string;
  onBusynessChange: (busyness: string) => void;
}

const VENUE_TYPES = [
  { value: 'all', label: 'All' },
  { value: 'bar', label: 'Bars' },
  { value: 'club', label: 'Clubs' },
  { value: 'latin_dance', label: 'Latin Dance' },
];

const BUSYNESS_LEVELS = [
  { value: 'all', label: 'Any Vibe', icon: '' },
  { value: 'packed', label: 'Packed', icon: '🔥' },
  { value: 'busy', label: 'Busy+', icon: '⚡' },
  { value: 'open', label: 'Open Now', icon: '✓' },
];

export default function FilterBar({
  selectedType,
  onTypeChange,
  selectedNeighborhood,
  onNeighborhoodChange,
  neighborhoods,
  latinTonightOnly,
  onLatinTonightChange,
  selectedBusyness,
  onBusynessChange,
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

      {/* Busyness filter dropdown */}
      <select
        value={selectedBusyness}
        onChange={(e) => onBusynessChange(e.target.value)}
        className="bg-zinc-800 text-white text-sm px-3 py-1.5 rounded-lg border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
      >
        {BUSYNESS_LEVELS.map(level => (
          <option key={level.value} value={level.value}>
            {level.icon} {level.label}
          </option>
        ))}
      </select>

      {/* Latin Tonight toggle */}
      <button
        onClick={() => onLatinTonightChange(!latinTonightOnly)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          latinTonightOnly
            ? 'bg-pink-600 text-white'
            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'
        }`}
      >
        💃 Latin Tonight
      </button>

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
