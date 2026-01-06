import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-zinc-300 mb-1">
          {label}
        </label>
      )}
      <input
        className={`
          w-full px-4 py-2 bg-zinc-900 border rounded-lg
          text-white placeholder-zinc-500
          focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-red-500' : 'border-zinc-700'}
          ${className}
        `}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}
