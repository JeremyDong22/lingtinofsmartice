// Update Prompt Component - Detects SW updates and prompts user to refresh
// v1.0 - Initial implementation with version display

'use client';

import { useEffect, useState } from 'react';

// Build version - updated on each deployment
export const APP_VERSION = '1.0.1';
export const BUILD_DATE = '2026-01-31';

export function UpdatePrompt() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [showVersion, setShowVersion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Listen for new service worker taking control
    const handleControllerChange = () => {
      // New SW has taken control, prompt user to refresh
      setShowUpdate(true);
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Also check for waiting service worker on load
    navigator.serviceWorker.ready.then((registration) => {
      // Check if there's a waiting worker
      if (registration.waiting) {
        setShowUpdate(true);
      }

      // Listen for new updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available, prompt user
              setShowUpdate(true);
            }
          });
        }
      });
    });

    // Log version on mount
    console.log(`[Lingtin] Version: ${APP_VERSION} (${BUILD_DATE})`);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const handleRefresh = () => {
    // Force reload to get new version
    window.location.reload();
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  const toggleVersion = () => {
    setShowVersion(!showVersion);
  };

  return (
    <>
      {/* Update notification banner */}
      {showUpdate && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white px-4 py-3 shadow-lg animate-slide-down">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-sm font-medium">有新版本可用</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                className="px-3 py-1 bg-white text-blue-600 rounded-full text-sm font-medium hover:bg-blue-50 transition-colors"
              >
                刷新
              </button>
              <button
                onClick={handleDismiss}
                className="p-1 hover:bg-blue-500 rounded-full transition-colors"
                aria-label="关闭"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version indicator - tap to show full version */}
      <button
        onClick={toggleVersion}
        className="fixed bottom-20 right-2 z-40 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="显示版本信息"
      >
        {showVersion ? `v${APP_VERSION} (${BUILD_DATE})` : `v${APP_VERSION}`}
      </button>
    </>
  );
}
