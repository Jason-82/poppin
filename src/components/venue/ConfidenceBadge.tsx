import React from 'react';

interface ConfidenceBadgeProps {
  confidence: number; // 0-1
}

export default function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  let level: string;
  let color: string;

  if (confidence < 0.33) {
    level = 'Low';
    color = 'text-red-400';
  } else if (confidence < 0.66) {
    level = 'Medium';
    color = 'text-yellow-400';
  } else {
    level = 'High';
    color = 'text-green-400';
  }

  return (
    <span className={`text-sm ${color}`}>
      Confidence: {level}
    </span>
  );
}
