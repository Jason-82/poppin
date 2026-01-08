'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import UserMenu from '@/components/auth/UserMenu';

export default function Header() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <header className="bg-zinc-900 border-b border-zinc-800">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/map" className="text-2xl font-bold text-white">
            Poppin
          </Link>

          <nav className="flex items-center gap-4 sm:gap-6">
            <Link
              href="/map"
              className={`text-sm font-medium transition-colors ${
                isActive('/map')
                  ? 'text-purple-400'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Map
            </Link>
            <Link
              href="/favorites"
              className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                isActive('/favorites')
                  ? 'text-purple-400'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
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
              <span className="hidden sm:inline">Favorites</span>
            </Link>
            <UserMenu />
          </nav>
        </div>
      </div>
    </header>
  );
}
