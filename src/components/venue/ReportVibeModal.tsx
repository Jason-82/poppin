'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import Button from '@/components/ui/Button';
import { submitReport, PointsResponse } from '@/lib/api';
import { BADGES, BadgeId } from '@/lib/gamification';

interface ReportVibeModalProps {
  venueId: string;
  venueName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const LEVEL_OPTIONS = [
  { value: 'dead' as const, label: 'Dead', description: 'Empty or very few people' },
  { value: 'warm' as const, label: 'Warm', description: 'Some people, relaxed vibe' },
  { value: 'busy' as const, label: 'Busy', description: 'Crowded, energetic' },
  { value: 'packed' as const, label: 'Packed', description: 'At capacity, hard to move' },
];

const TAG_OPTIONS = [
  'good_music',
  'long_wait',
  'great_crowd',
  'expensive',
  'cheap_drinks',
  'dancing',
  'chill_vibe',
  'loud',
];

const WAIT_OPTIONS = [
  { value: 0, label: 'No wait' },
  { value: 5, label: '~5 min' },
  { value: 15, label: '~15 min' },
  { value: 30, label: '~30 min' },
  { value: 60, label: '1 hour+' },
];

export default function ReportVibeModal({
  venueId,
  venueName,
  isOpen,
  onClose,
  onSuccess,
}: ReportVibeModalProps) {
  const { data: session } = useSession();
  const [selectedLevel, setSelectedLevel] = useState<'dead' | 'warm' | 'busy' | 'packed' | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [coverCharge, setCoverCharge] = useState<number | null>(null);
  const [hasCover, setHasCover] = useState<boolean | null>(null);
  const [waitMinutes, setWaitMinutes] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<PointsResponse | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setSuccessData(null);
    setSelectedLevel(null);
    setSelectedTags([]);
    setCoverCharge(null);
    setHasCover(null);
    setWaitMinutes(null);
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedLevel) {
      setError('Please select a busyness level');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await submitReport(venueId, {
        level: selectedLevel,
        tags: selectedTags,
        coverCharge: hasCover === false ? 0 : coverCharge,
        waitMinutes,
      });
      onSuccess?.();

      // If user earned points, show success screen
      if (result.points) {
        setSuccessData(result.points);
      } else {
        handleClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  // Success screen showing points earned
  if (successData) {
    const newBadges = successData.newBadges.map((id) => BADGES[id as BadgeId]).filter(Boolean);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-md w-full text-center">
          <div className="text-5xl mb-4">+{successData.awarded}</div>
          <h2 className="text-2xl font-bold text-white mb-2">Points Earned!</h2>
          <p className="text-zinc-400 mb-4">
            Thanks for reporting the vibe at {venueName}
          </p>

          <div className="flex items-center justify-center gap-1 text-lg text-yellow-400 mb-6">
            <span>Total: {successData.total} pts</span>
          </div>

          {newBadges.length > 0 && (
            <div className="mb-6">
              <div className="text-sm text-zinc-400 mb-2">New Badges Earned!</div>
              <div className="flex flex-wrap justify-center gap-2">
                {newBadges.map((badge) => (
                  <div
                    key={badge.id}
                    className="flex items-center gap-2 px-3 py-2 bg-purple-900/30 border border-purple-500 rounded-lg"
                  >
                    <span className="text-2xl">{badge.icon}</span>
                    <div className="text-left">
                      <div className="font-medium text-white">{badge.name}</div>
                      <div className="text-xs text-zinc-400">{badge.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button variant="primary" onClick={handleClose} className="w-full">
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-white mb-2">Report Vibe</h2>
        <p className="text-zinc-400 mb-6">{venueName}</p>

        {/* Level Selection */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">How busy is it right now?</h3>
          <div className="space-y-2">
            {LEVEL_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => setSelectedLevel(option.value)}
                className={`
                  w-full text-left p-3 rounded-lg border transition-colors
                  ${
                    selectedLevel === option.value
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-zinc-700 hover:border-zinc-600'
                  }
                `}
              >
                <div className="font-medium text-white">{option.label}</div>
                <div className="text-sm text-zinc-400">{option.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Tags (optional)</h3>
          <div className="flex flex-wrap gap-2">
            {TAG_OPTIONS.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`
                  px-3 py-1.5 rounded-full text-sm transition-colors
                  ${
                    selectedTags.includes(tag)
                      ? 'bg-purple-600 text-white'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }
                `}
              >
                {tag.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Cover Charge */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Cover charge? (optional)</h3>
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => { setHasCover(false); setCoverCharge(null); }}
              className={`
                flex-1 py-2 px-3 rounded-lg text-sm transition-colors
                ${hasCover === false
                  ? 'bg-green-600 text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }
              `}
            >
              No cover
            </button>
            <button
              onClick={() => setHasCover(true)}
              className={`
                flex-1 py-2 px-3 rounded-lg text-sm transition-colors
                ${hasCover === true
                  ? 'bg-purple-600 text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }
              `}
            >
              Yes, there&apos;s a cover
            </button>
          </div>
          {hasCover && (
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">$</span>
              <input
                type="number"
                min="1"
                max="200"
                value={coverCharge || ''}
                onChange={(e) => setCoverCharge(e.target.value ? parseInt(e.target.value, 10) : null)}
                placeholder="Amount"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          )}
        </div>

        {/* Wait Time */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Line wait time? (optional)</h3>
          <div className="flex flex-wrap gap-2">
            {WAIT_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => setWaitMinutes(option.value)}
                className={`
                  px-3 py-1.5 rounded-lg text-sm transition-colors
                  ${waitMinutes === option.value
                    ? 'bg-purple-600 text-white'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Sign-in prompt for non-authenticated users */}
        {!session && (
          <div className="mb-4 p-3 bg-purple-900/20 border border-purple-700 rounded-lg">
            <p className="text-sm text-purple-300">
              Sign in to earn points and badges for your reports!
            </p>
          </div>
        )}

        {/* Privacy Notice */}
        <div className="mb-4 p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg">
          <p className="text-xs text-zinc-400">
            Your report is anonymous and helps others find great spots.
            We use a browser fingerprint to prevent spam (no personal data collected).
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedLevel}
            className="flex-1"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </div>
      </div>
    </div>
  );
}
