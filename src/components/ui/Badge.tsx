import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

export default function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  const variantClasses = {
    default: 'bg-zinc-700 text-zinc-100',
    success: 'bg-green-600 text-white',
    warning: 'bg-yellow-500 text-black',
    danger: 'bg-red-600 text-white',
    info: 'bg-blue-600 text-white',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}
