'use client';

import React, { useState } from 'react';
import Button from '@/components/ui/Button';
import { submitReport } from '@/lib/api';

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

export default function ReportVibeModal({
  venueId,
  venueName,
  isOpen,
  onClose,
  onSuccess,
}: ReportVibeModalProps) {
  const [selectedLevel, setSelectedLevel] = useState<'dead' | 'warm' | 'busy' | 'packed' | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selectedLevel) {
      setError('Please select a busyness level');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await submitReport(venueId, selectedLevel, selectedTags);
      onSuccess?.();
      onClose();
      // Reset form
      setSelectedLevel(null);
      setSelectedTags([]);
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

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
            {error}
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
            onClick={onClose}
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
