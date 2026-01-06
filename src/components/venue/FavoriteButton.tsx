'use client';

import React, { useState, useEffect } from 'react';
import { isFavorite, toggleFavorite } from '@/lib/favorites';

interface FavoriteButtonProps {
  venueId: string;
  className?: string;
}

export default function FavoriteButton({ venueId, className = '' }: FavoriteButtonProps) {
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    setIsFav(isFavorite(venueId));
  }, [venueId]);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newState = toggleFavorite(venueId);
    setIsFav(newState);
  };

  return (
    <button
      onClick={handleToggle}
      className={`p-2 rounded-lg transition-colors ${
        isFav
          ? 'text-red-500 hover:text-red-400'
          : 'text-zinc-500 hover:text-zinc-400'
      } ${className}`}
      aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        fill={isFav ? 'currentColor' : 'none'}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
    </button>
  );
}
