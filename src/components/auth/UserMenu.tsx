'use client';

import React, { useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import Image from 'next/image';
import { BADGES, BadgeId } from '@/lib/gamification';

export default function UserMenu() {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);

  if (status === 'loading') {
    return (
      <div className="w-8 h-8 rounded-full bg-zinc-700 animate-pulse" />
    );
  }

  if (!session) {
    return (
      <button
        onClick={() => signIn('google')}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
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
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
        Sign in
      </button>
    );
  }

  const badges = session.user.badges || [];
  const displayBadges = badges.slice(0, 3).map((id) => BADGES[id as BadgeId]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
      >
        {session.user.image ? (
          <Image
            src={session.user.image}
            alt={session.user.name || 'User'}
            width={32}
            height={32}
            className="rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-medium">
            {session.user.name?.charAt(0) || '?'}
          </div>
        )}
        <div className="hidden sm:flex items-center gap-1 text-yellow-400 font-medium text-sm">
          <span>⭐</span>
          <span>{session.user.points || 0}</span>
        </div>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-64 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-zinc-700">
              <div className="flex items-center gap-3">
                {session.user.image ? (
                  <Image
                    src={session.user.image}
                    alt={session.user.name || 'User'}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-medium">
                    {session.user.name?.charAt(0) || '?'}
                  </div>
                )}
                <div>
                  <div className="font-medium text-white">
                    {session.user.name}
                  </div>
                  <div className="text-sm text-zinc-400">
                    {session.user.email}
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="p-4 border-b border-zinc-700">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold text-yellow-400 mb-2">
                <span>⭐</span>
                <span>{session.user.points || 0}</span>
                <span className="text-sm font-normal text-zinc-400 ml-1">pts</span>
              </div>
              <div className="flex justify-center gap-6 text-sm text-zinc-400">
                <div className="text-center">
                  <div className="font-medium text-white">
                    {session.user.reportsCount || 0}
                  </div>
                  <div>Reports</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-white">
                    {session.user.videosCount || 0}
                  </div>
                  <div>Videos</div>
                </div>
              </div>
            </div>

            {/* Badges */}
            {displayBadges.length > 0 && (
              <div className="p-4 border-b border-zinc-700">
                <div className="text-xs text-zinc-400 mb-2">Badges</div>
                <div className="flex gap-2">
                  {displayBadges.map((badge) => (
                    <div
                      key={badge.id}
                      className="flex items-center gap-1 px-2 py-1 bg-zinc-800 rounded-full text-xs"
                      title={badge.description}
                    >
                      <span>{badge.icon}</span>
                      <span className="text-zinc-300">{badge.name}</span>
                    </div>
                  ))}
                </div>
                {badges.length > 3 && (
                  <div className="text-xs text-zinc-500 mt-1">
                    +{badges.length - 3} more
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="p-2">
              <button
                onClick={() => {
                  setIsOpen(false);
                  signOut();
                }}
                className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
