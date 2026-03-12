// Update Prompt Component - Detects SW updates and auto-reloads
// v4.0 - Added network-based version check (version.json) for reliable update detection
// Works for both PWA (service worker) and regular browser (fetch-based)

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

// Build version - updated on each deployment
export const APP_VERSION = '2.5.0';
export const BUILD_DATE = '2026-03-12';

const VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Force clear all caches, unregister SW, and hard reload
async function forceUpdateApp() {
  console.log('[Lingtin] Force updating app...');
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(r => r.unregister()));
      console.log(`[Lingtin] Unregistered ${registrations.length} service worker(s)`);
    }
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log(`[Lingtin] Cleared ${cacheNames.length} cache(s)`);
    }
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith('lingtin_chat_') || key === 'lingtin-swr-cache' || key === 'lingtin-swr-cache-date') {
        localStorage.removeItem(key);
      }
    }
  } catch (err) {
    console.error('[Lingtin] Error during force update:', err);
  }
  window.location.reload();
}

// Fetch deployed version from server (cache-busted) and compare with compiled-in version
async function checkVersionFromNetwork(): Promise<boolean> {
  try {
    const res = await fetch(`/version.json?_t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.version && data.version !== APP_VERSION) {
      console.log(`[Lingtin] Version mismatch: local=${APP_VERSION}, server=${data.version}`);
      return true; // update needed
    }
  } catch {
    // Network error — can't check, skip
  }
  return false;
}

export function UpdatePrompt() {
  const [updating, setUpdating] = useState(false);
  const [showVersion, setShowVersion] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUpdatingRef = useRef(false);

  const triggerAutoUpdate = useCallback((reason: string) => {
    if (isUpdatingRef.current) return;
    isUpdatingRef.current = true;
    console.log(`[Lingtin] Auto-update triggered: ${reason}`);
    setUpdating(true);
    setTimeout(() => forceUpdateApp(), 1000);
  }, []);

  // --- Network-based version check (works for both PWA and browser) ---
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let interval: ReturnType<typeof setInterval>;

    const doVersionCheck = async (trigger: string) => {
      if (isUpdatingRef.current) return;
      const needsUpdate = await checkVersionFromNetwork();
      if (needsUpdate) {
        triggerAutoUpdate(`version.json mismatch (${trigger})`);
      }
    };

    // Check on mount (after brief delay to avoid blocking initial render)
    const mountTimer = setTimeout(() => doVersionCheck('mount'), 3000);

    // Periodic check
    interval = setInterval(() => doVersionCheck('periodic'), VERSION_CHECK_INTERVAL);

    // Check on foreground resume
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        doVersionCheck('foreground');
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearTimeout(mountTimer);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [triggerAutoUpdate]);

  // --- Service Worker update detection (PWA only) ---
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let swCheckInterval: ReturnType<typeof setInterval>;

    const handleControllerChange = () => triggerAutoUpdate('controllerchange');
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    navigator.serviceWorker.ready.then((registration) => {
      if (registration.waiting) {
        triggerAutoUpdate('waiting worker found');
        return;
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            triggerAutoUpdate('new worker installed');
          }
        });
      });

      // Check for SW updates on page load
      registration.update().catch(() => {});

      // Periodic SW check
      swCheckInterval = setInterval(() => {
        registration.update().catch(() => {});
      }, VERSION_CHECK_INTERVAL);
    });

    console.log(`[Lingtin] Version: ${APP_VERSION} (${BUILD_DATE})`);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      clearInterval(swCheckInterval);
    };
  }, [triggerAutoUpdate]);

  const toggleVersion = () => setShowVersion(prev => !prev);

  // Long-press (1.5s) on version badge = force update (debug shortcut)
  const handleVersionTouchStart = () => {
    longPressTimer.current = setTimeout(async () => {
      if (confirm('强制清除缓存并更新？')) {
        setUpdating(true);
        await forceUpdateApp();
      }
    }, 1500);
  };

  const handleVersionTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <>
      {updating && (
        <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-600 font-medium">正在更新...</p>
          </div>
        </div>
      )}

      <button
        onClick={toggleVersion}
        onTouchStart={handleVersionTouchStart}
        onTouchEnd={handleVersionTouchEnd}
        onMouseDown={handleVersionTouchStart}
        onMouseUp={handleVersionTouchEnd}
        onMouseLeave={handleVersionTouchEnd}
        className="fixed bottom-20 right-2 z-40 text-[10px] text-gray-400 hover:text-gray-600 transition-colors select-none"
        aria-label="显示版本信息"
      >
        {showVersion ? `v${APP_VERSION} (${BUILD_DATE})` : `v${APP_VERSION}`}
      </button>
    </>
  );
}
