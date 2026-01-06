'use client';

import React from 'react';
import Button from '@/components/ui/Button';

interface FilterBarProps {
  selectedType: string;
  onTypeChange: (type: string) => void;
}

const VENUE_TYPES = [
  { value: 'all', label: 'All' },
  { value: 'bar', label: 'Bars' },
  { value: 'club', label: 'Clubs' },
  { value: 'latin_dance', label: 'Latin Dance' },
];

export default function FilterBar({ selectedType, onTypeChange }: FilterBarProps) {
  return (
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
  );
}
