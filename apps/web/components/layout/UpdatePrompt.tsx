// Update Prompt Component - Detects SW updates and auto-reloads
// v3.0 - Auto-reload on update detection + foreground check + periodic polling

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

// Build version - updated on each deployment
export const APP_VERSION = '2.4.1';
export const BUILD_DATE = '2026-03-08';

const UPDATE_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

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

export function UpdatePrompt() {
  const [updating, setUpdating] = useState(false);
  const [showVersion, setShowVersion] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-reload: brief delay so user sees "正在更新..."
  const triggerAutoUpdate = useCallback((reason: string) => {
    console.log(`[Lingtin] Auto-update triggered: ${reason}`);
    setUpdating(true);
    setTimeout(() => forceUpdateApp(), 1000);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let updateCheckInterval: ReturnType<typeof setInterval>;
    let isUpdating = false;

    const doAutoUpdate = (reason: string) => {
      if (isUpdating) return;
      isUpdating = true;
      triggerAutoUpdate(reason);
    };

    // 1. controllerchange → new SW took over, page needs reload
    const handleControllerChange = () => doAutoUpdate('controllerchange');
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    navigator.serviceWorker.ready.then((registration) => {
      // 2. Already a waiting worker → update now
      if (registration.waiting) {
        doAutoUpdate('waiting worker found');
        return;
      }

      // 3. New worker installed → update when ready
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            doAutoUpdate('new worker installed');
          }
        });
      });

      // 4. Check for updates on page load (Safari workaround)
      registration.update().catch(() => {});

      // 5. Periodic check every 30 minutes
      updateCheckInterval = setInterval(() => {
        console.log('[Lingtin] Periodic SW update check');
        registration.update().catch(() => {});
      }, UPDATE_CHECK_INTERVAL);

      // 6. Check on foreground resume (critical for mobile PWA)
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          console.log('[Lingtin] App foregrounded, checking for updates');
          registration.update().catch(() => {});
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Store cleanup ref
      (registration as unknown as Record<string, () => void>).__cleanupVisibility = () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    });

    console.log(`[Lingtin] Version: ${APP_VERSION} (${BUILD_DATE})`);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      clearInterval(updateCheckInterval);
      // Clean up visibilitychange if registration was resolved
      navigator.serviceWorker.ready.then((reg) => {
        const cleanup = (reg as unknown as Record<string, () => void>).__cleanupVisibility;
        cleanup?.();
      });
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
      {/* Auto-update overlay - shown briefly before reload */}
      {updating && (
        <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-600 font-medium">正在更新...</p>
          </div>
        </div>
      )}

      {/* Version indicator - tap to toggle, long-press to force update */}
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
