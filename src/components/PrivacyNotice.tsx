'use client';

import React, { useState } from 'react';
import Button from './ui/Button';
import Card from './ui/Card';

export default function PrivacyNotice() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      {/* Footer Privacy Statement */}
      <div className="border-t border-zinc-800 bg-black py-6 mt-auto">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-zinc-400 mb-2">
            Poppin respects your privacy. We collect anonymous venue reports to show
            real-time busyness. No personal data, no tracking, no accounts required.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-sm text-purple-400 hover:text-purple-300 underline"
          >
            View Privacy Policy
          </button>
        </div>
      </div>

      {/* Privacy Policy Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold text-white">Privacy Policy</h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-zinc-400 hover:text-white text-2xl leading-none"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-6 text-zinc-300">
                <section>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    What We Collect
                  </h3>
                  <p className="text-sm mb-2">
                    When you report a venue's busyness, we collect:
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-1 ml-4">
                    <li>The busyness level you select (Quiet, Warm, Busy, Packed)</li>
                    <li>Optional vibe tags (e.g., "good music", "long wait")</li>
                    <li>Time of your report</li>
                    <li>
                      Technical data for abuse prevention (hashed IP address, browser
                      fingerprint)
                    </li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    What We DON'T Collect
                  </h3>
                  <ul className="list-disc list-inside text-sm space-y-1 ml-4">
                    <li>No names, emails, or phone numbers</li>
                    <li>No account creation required</li>
                    <li>No location tracking (only the venue you choose to report)</li>
                    <li>No background data collection</li>
                    <li>No selling your data to third parties</li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    How We Use Your Data
                  </h3>
                  <p className="text-sm mb-2">Your reports are:</p>
                  <ul className="list-disc list-inside text-sm space-y-1 ml-4">
                    <li>
                      <strong>Anonymous:</strong> We don't know who you are
                    </li>
                    <li>
                      <strong>Aggregated:</strong> Combined with other reports to show
                      crowd levels
                    </li>
                    <li>
                      <strong>Temporary:</strong> Reports older than 90 days are
                      automatically deleted
                    </li>
                  </ul>
                  <p className="text-sm mt-3">
                    We use technical data (IP addresses, browser fingerprints) only to
                    prevent spam and abuse. This data is hashed (one-way encrypted) and
                    never shared.
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-semibold text-white mb-2">Cookies</h3>
                  <p className="text-sm mb-2">We use two cookies:</p>
                  <ul className="list-disc list-inside text-sm space-y-1 ml-4">
                    <li>
                      <strong>Authentication cookie</strong> (30 days): Remembers you
                      entered the passcode
                    </li>
                    <li>
                      <strong>Browser token</strong> (1 year): Prevents spam by limiting
                      reports per device
                    </li>
                  </ul>
                  <p className="text-sm mt-3">
                    Both are "HTTP-only" (secure) and contain no personal information.
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Your Rights
                  </h3>
                  <p className="text-sm">
                    Since we don't collect personal data, there's nothing to request or
                    delete. You're always anonymous.
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Data Security
                  </h3>
                  <p className="text-sm">
                    We take security seriously. Your reports are stored securely, IP
                    addresses are hashed using SHA-256 (one-way encryption), and all
                    connections use HTTPS encryption.
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-semibold text-white mb-2">Contact</h3>
                  <p className="text-sm">
                    Questions about privacy? We're happy to help. This is a friends-only
                    beta, so reach out to the app creator directly.
                  </p>
                </section>

                <div className="text-xs text-zinc-500 pt-4 border-t border-zinc-700">
                  Last Updated: January 6, 2026
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button onClick={() => setIsModalOpen(false)} variant="primary">
                  Got it
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
