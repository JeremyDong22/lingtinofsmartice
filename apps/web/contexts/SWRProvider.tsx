// SWR Provider - Global data fetching configuration with localStorage persistence
// v1.4 - Cache: disable revalidateOnFocus, 30s periodic sync, 2MB limit, cross-day expiry
// v1.3 - Added: Auto-logout on 401 (expired token) for all API calls

'use client';

import { SWRConfig, Cache, State } from 'swr';
import { ReactNode, useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/api';

// Cache key for localStorage
const CACHE_KEY = 'lingtin-swr-cache';
const CACHE_DATE_KEY = 'lingtin-swr-cache-date';
const MAX_CACHE_BYTES = 2 * 1024 * 1024; // 2MB

// SWR Cache type
type SWRCache = Cache<State<unknown, unknown>>;

// API path whitelist for cache persistence
function isCacheableKey(key: string): boolean {
  return key.includes('/api/dashboard/') || key.includes('/api/audio/') ||
    key.includes('/api/action-items') || key.includes('/api/meeting/') ||
    key.includes('/api/daily-summary') || key.includes('/api/feedback/') ||
    key.includes('/api/question-templates');
}

// Get today's date string in YYYY-MM-DD (China time)
function getTodayDate(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
}

// Persist cache to localStorage (shared by beforeunload + periodic sync)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function persistCache(map: Map<string, any>) {
  let entries = Array.from(map.entries()).filter(([key]) => isCacheableKey(key));
  let json = JSON.stringify(entries);
  // Enforce 2MB size limit — keep halving until it fits
  while (json.length > MAX_CACHE_BYTES && entries.length > 1) {
    entries = entries.slice(-Math.floor(entries.length / 2));
    json = JSON.stringify(entries);
  }
  try {
    localStorage.setItem(CACHE_KEY, json);
    localStorage.setItem(CACHE_DATE_KEY, getTodayDate());
  } catch (e) {
    // QuotaExceededError: clear stale chat keys and retry once
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      clearStaleChatKeys();
      try {
        localStorage.setItem(CACHE_KEY, json);
        localStorage.setItem(CACHE_DATE_KEY, getTodayDate());
      } catch {
        // Still full — give up, cache will rebuild from API on next load
      }
    }
  }
}

// Remove expired lingtin_chat_* keys to free space
function clearStaleChatKeys() {
  const today = getTodayDate();
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key?.startsWith('lingtin_chat_')) continue;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '');
      if (parsed.date && parsed.date !== today) {
        localStorage.removeItem(key);
      }
    } catch {
      if (key) localStorage.removeItem(key);
    }
  }
}

interface CacheWithCleanup extends SWRCache {
  _cleanup?: () => void;
}

// Create localStorage-based cache provider for SWR persistence
function createLocalStorageProvider(): CacheWithCleanup {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cachedData: [string, any][] = [];

  if (typeof window !== 'undefined') {
    // Cross-day: discard stale cache
    const cachedDate = localStorage.getItem(CACHE_DATE_KEY);
    if (cachedDate && cachedDate !== getTodayDate()) {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_DATE_KEY);
    } else {
      try {
        const stored = localStorage.getItem(CACHE_KEY);
        if (stored) {
          cachedData = JSON.parse(stored);
        }
      } catch {
        // Ignore parse errors, start fresh
      }
    }
  }

  const map = new Map(cachedData);

  const cache = map as CacheWithCleanup;

  if (typeof window !== 'undefined') {
    // Save on page unload (works for normal tab close)
    const onUnload = () => persistCache(map);
    window.addEventListener('beforeunload', onUnload);

    // Periodic sync every 30s (covers PWA being killed without beforeunload)
    const intervalId = setInterval(() => persistCache(map), 30_000);

    // Cleanup for HMR / remount
    cache._cleanup = () => {
      clearInterval(intervalId);
      window.removeEventListener('beforeunload', onUnload);
    };
  }

  return cache;
}

// Auth keys (must match AuthContext.tsx)
const AUTH_TOKEN_KEY = 'lingtin_auth_token';
const AUTH_USER_KEY = 'lingtin_auth_user';

// Handle 401: clear stored credentials and redirect to login
function handleAuthExpired() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(CACHE_KEY);
  window.location.href = '/login';
}

// Global fetcher function with auth headers
// Converts relative URLs to full backend API URLs
// Auto-redirects to login on 401 (expired token)
export async function fetcher<T>(url: string): Promise<T> {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem(AUTH_TOKEN_KEY)
    : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Convert relative URL to full backend URL
  const fullUrl = url.startsWith('/') ? getApiUrl(url.slice(1)) : url;
  const res = await fetch(fullUrl, { headers });

  if (!res.ok) {
    // Token expired or invalid - auto logout and redirect to login
    if (res.status === 401) {
      handleAuthExpired();
    }
    const error = new Error('API request failed');
    (error as Error & { status: number }).status = res.status;
    throw error;
  }

  return res.json();
}

interface SWRProviderProps {
  children: ReactNode;
}

export function SWRProvider({ children }: SWRProviderProps) {
  // Start with an empty Map so SWRConfig wraps children from the very first render.
  // This ensures useSWR hooks always have access to the fetcher — no "null provider" window.
  const [provider, setProvider] = useState<CacheWithCleanup>(
    () => new Map() as CacheWithCleanup,
  );

  // Replace the placeholder Map with the real localStorage-backed cache on mount
  useEffect(() => {
    const cache = createLocalStorageProvider();
    setProvider(cache);
    return () => cache._cleanup?.();
  }, []);

  return (
    <SWRConfig
      value={{
        provider: () => provider,
        fetcher,
        // Stale-while-revalidate: show cached data immediately, fetch in background
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        // Deduplicate requests within 1 minute (prevents burst requests on navigation)
        dedupingInterval: 60000,
        // Keep previous data while loading new data (smooth transitions)
        keepPreviousData: true,
        // Retry on error
        errorRetryCount: 2,
        errorRetryInterval: 3000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
