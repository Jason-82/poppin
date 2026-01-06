'use client';

import React, { useState } from 'react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { verifyPasscode } from '@/lib/api';

interface PasscodeFormProps {
  onSuccess: () => void;
}

export default function PasscodeForm({ onSuccess }: PasscodeFormProps) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await verifyPasscode(passcode);

      if (result.success) {
        onSuccess();
      } else {
        setError(result.error || 'Invalid passcode');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <div className="text-center mb-6">
        <h1 className="text-5xl font-bold text-white mb-2">Poppin</h1>
        <p className="text-zinc-400 text-lg">Chicago Nightlife Busyness</p>
      </div>

      <Input
        type="password"
        placeholder="Enter passcode"
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        error={error || undefined}
        autoFocus
        maxLength={6}
      />

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={isSubmitting || passcode.length < 4}
      >
        {isSubmitting ? 'Verifying...' : 'Enter'}
      </Button>

      <p className="text-sm text-zinc-500 text-center">
        Friends-only access. Ask the owner for the passcode.
      </p>
    </form>
  );
}
