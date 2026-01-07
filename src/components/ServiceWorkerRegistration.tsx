'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Register service worker
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('[App] Service Worker registered successfully:', registration.scope);

          // Check for updates periodically
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[App] New service worker available');
                  // Optionally notify user about update
                  // You could show a toast or banner here
                }
              });
            }
          });

          // Check for updates every hour
          setInterval(() => {
            registration.update();
          }, 60 * 60 * 1000);
        })
        .catch((error) => {
          console.error('[App] Service Worker registration failed:', error);
        });

      // Handle controller change (new SW activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[App] Service Worker controller changed');
      });
    } else {
      console.log('[App] Service Workers are not supported in this browser');
    }
  }, []);

  return null; // This component doesn't render anything
}
