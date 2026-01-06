import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  ...props
}: ButtonProps) {
  const variantClasses = {
    primary: 'bg-purple-600 text-white hover:bg-purple-700 focus:ring-purple-500',
    secondary: 'bg-zinc-700 text-white hover:bg-zinc-600 focus:ring-zinc-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    ghost: 'bg-transparent text-zinc-300 hover:bg-zinc-800 focus:ring-zinc-500',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={`
        rounded-lg font-medium transition-colors duration-200
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]} ${sizeClasses[size]} ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
