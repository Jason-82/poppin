import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      className={`
        bg-zinc-900 border border-zinc-800 rounded-lg p-4
        ${onClick ? 'cursor-pointer hover:border-zinc-700 transition-colors' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
