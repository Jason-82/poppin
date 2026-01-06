import React from 'react';

interface TrendArrowProps {
  trend: 'up' | 'down' | 'stable';
  showText?: boolean;
}

export default function TrendArrow({ trend, showText = false }: TrendArrowProps) {
  const trendConfig = {
    up: {
      arrow: '↑',
      text: 'Getting busier',
      color: 'text-red-400',
    },
    down: {
      arrow: '↓',
      text: 'Quieting down',
      color: 'text-green-400',
    },
    stable: {
      arrow: '→',
      text: 'Stable',
      color: 'text-zinc-400',
    },
  };

  const config = trendConfig[trend];

  return (
    <span className={`inline-flex items-center gap-1 ${config.color}`}>
      <span className="text-lg font-bold">{config.arrow}</span>
      {showText && <span className="text-sm">{config.text}</span>}
    </span>
  );
}
