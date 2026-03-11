// Landing Analytics Hook - Lightweight event tracking for PMF validation
// Tracks: page_view, scroll_depth, dwell_time, form_start, form_submit, share_click
// Uses sendBeacon for reliable delivery on page close (WeChat compatible)

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { getApiUrl } from '@/lib/api';

// ─── Fingerprint (djb2 hash, no third-party library) ───

function djb2Hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function getVisitorId(): string {
  const parts = [
    screen.width, screen.height, screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
    navigator.userAgent,
  ];
  return djb2Hash(parts.join('|'));
}

function getSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx'.replace(/[x]/g, () =>
    ((Math.random() * 16) | 0).toString(16),
  );
}

// ─── Types ───

type EventType = 'page_view' | 'scroll_depth' | 'dwell_time' | 'form_start' | 'form_submit' | 'share_click';

interface AnalyticsEvent {
  visitor_id: string;
  session_id: string;
  event_type: EventType;
  payload?: Record<string, unknown>;
  referrer?: string;
  user_agent?: string;
  screen_width?: number;
  screen_height?: number;
}

// ─── Hook ───

export function useLandingAnalytics() {
  const visitorIdRef = useRef<string>('');
  const sessionIdRef = useRef<string>('');
  const bufferRef = useRef<AnalyticsEvent[]>([]);
  const maxScrollRef = useRef(0);
  const startTimeRef = useRef(Date.now());
  const flushedRef = useRef(false);

  // Create a base event with common fields
  const makeEvent = useCallback((type: EventType, payload?: Record<string, unknown>): AnalyticsEvent => ({
    visitor_id: visitorIdRef.current,
    session_id: sessionIdRef.current,
    event_type: type,
    payload,
    referrer: document.referrer || undefined,
    user_agent: navigator.userAgent,
    screen_width: screen.width,
    screen_height: screen.height,
  }), []);

  // Flush buffer to API
  const flush = useCallback((useBeacon = false) => {
    const events = bufferRef.current.splice(0);
    if (events.length === 0) return;

    const url = getApiUrl('api/landing-analytics/events');
    const body = JSON.stringify({ events });

    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    } else {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => { /* silent - analytics is best-effort */ });
    }
  }, []);

  // Public: track a custom event
  const track = useCallback((type: EventType, payload?: Record<string, unknown>) => {
    bufferRef.current.push(makeEvent(type, payload));
  }, [makeEvent]);

  useEffect(() => {
    visitorIdRef.current = getVisitorId();
    sessionIdRef.current = getSessionId();
    startTimeRef.current = Date.now();

    // Track page view immediately
    bufferRef.current.push(makeEvent('page_view'));

    // Scroll tracking
    const onScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const pct = Math.round((scrollTop / docHeight) * 100);
      if (pct > maxScrollRef.current) {
        maxScrollRef.current = pct;
      }
    };

    // Flush final events (scroll_depth + dwell_time) on page leave
    const onLeave = () => {
      if (flushedRef.current) return;
      flushedRef.current = true;

      const dwellSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      bufferRef.current.push(makeEvent('dwell_time', { seconds: dwellSeconds }));

      if (maxScrollRef.current > 0) {
        bufferRef.current.push(makeEvent('scroll_depth', { max_depth: maxScrollRef.current }));
      }

      flush(true);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    // WeChat compatibility: listen to multiple unload signals
    window.addEventListener('beforeunload', onLeave);
    window.addEventListener('pagehide', onLeave);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') onLeave();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Periodic flush every 10 seconds
    const interval = setInterval(() => flush(false), 10_000);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('beforeunload', onLeave);
      window.removeEventListener('pagehide', onLeave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(interval);
      // Final flush on unmount
      if (!flushedRef.current) onLeave();
    };
  }, [makeEvent, flush]);

  return { track };
}
