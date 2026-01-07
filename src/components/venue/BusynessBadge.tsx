import React from 'react';

interface BusynessBadgeProps {
  level: number; // 0-100
  confidence?: number; // 0-1 (optional)
  size?: 'sm' | 'md' | 'lg';
}

export default function BusynessBadge({ level, confidence, size = 'md' }: BusynessBadgeProps) {
  // Determine band and color
  let band: string;
  let bgColor: string;
  let textColor: string;

  // Handle special cases first
  if (level === -1) {
    // Venue is currently closed
    band = 'Closed';
    bgColor = 'bg-zinc-700';
    textColor = 'text-zinc-300';
  } else if (confidence !== undefined && confidence < 0.2) {
    // PRIVACY FIX: If confidence is very low (< 0.2), show uncertainty
    band = 'No Data';
    bgColor = 'bg-zinc-600';
    textColor = 'text-white';
  } else if (level <= 25) {
    band = 'Quiet';
    bgColor = 'bg-blue-500';
    textColor = 'text-white';
  } else if (level <= 50) {
    band = 'Warming Up';
    bgColor = 'bg-green-500';
    textColor = 'text-white';
  } else if (level <= 75) {
    band = 'Busy';
    bgColor = 'bg-yellow-500';
    textColor = 'text-black';
  } else {
    band = 'Packed!';
    bgColor = 'bg-purple-500';
    textColor = 'text-white';
  }

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${bgColor} ${textColor} ${sizeClasses[size]}`}>
      {band}
    </span>
  );
}
