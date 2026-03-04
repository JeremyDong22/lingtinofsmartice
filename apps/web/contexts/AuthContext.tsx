// Auth Context - Manage authentication state across the app
// v1.3 - Added role-based routing: administrator goes to /admin/dashboard, others to /recorder

'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getApiUrl } from '@/lib/api';
import { tStatic } from '@/lib/i18n';

interface User {
  id: string;
  username: string;
  employeeName: string;
  restaurantId: string;
  restaurantName: string;
  roleCode: string;
  managedRestaurantIds: string[] | null;  // null = HQ admin (see all)
  managedRegionIds: string[] | null;      // region-based scope
  isSuperAdmin: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'lingtin_auth_token';
const USER_KEY = 'lingtin_auth_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Load auth state from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {
        // Invalid stored data, clear it
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  // Redirect to login if not authenticated (except on login page)
  useEffect(() => {
    if (!isLoading && !user && pathname !== '/login') {
      router.push('/login');
    }
  }, [isLoading, user, pathname, router]);

  const login = useCallback(async (username: string, password: string) => {
    const MAX_RETRIES = 2;
    const TIMEOUT_MS = 15000; // 15s per attempt

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const response = await fetch(getApiUrl('api/auth/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          let errorMessage = tStatic('auth.loginFailed');
          try {
            const error = await response.json();
            errorMessage = error.message || tStatic('auth.loginFailed');
          } catch {
            errorMessage = response.status === 401
              ? tStatic('auth.wrongCredentials')
              : `${tStatic('auth.serverError')} (${response.status})`;
          }
          // 401 is a credential error — don't retry
          if (response.status === 401) {
            throw new Error(errorMessage);
          }
          lastError = new Error(errorMessage);
          // Retry on server errors (5xx)
          if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
            continue;
          }
          throw lastError;
        }

        const data = await response.json();

        // Clear any previous error on success
        lastError = null;

        // Store in state and localStorage
        setToken(data.access_token);
        setUser(data.user);
        localStorage.setItem(TOKEN_KEY, data.access_token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));

        // Route based on role — AI 智库 as home for all roles
        if (data.user.roleCode === 'administrator') {
          router.push('/admin/chat');
        } else if (data.user.roleCode === 'head_chef' || data.user.roleCode === 'chef') {
          router.push('/chef/chat');
        } else {
          router.push('/chat');
        }
        return; // Success — exit retry loop
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof DOMException && err.name === 'AbortError') {
          lastError = new Error(tStatic('auth.timeout'));
        } else if (err instanceof TypeError && err.message.includes('fetch')) {
          lastError = new Error(tStatic('auth.networkError'));
        } else if (err instanceof Error) {
          // Credential errors (401) — don't retry
          if (err.message === tStatic('auth.wrongCredentials')) {
            throw err;
          }
          lastError = err;
        } else {
          lastError = new Error(tStatic('auth.loginFailed'));
        }
        // Retry on timeout/network errors
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }
      }
    }
    // All retries exhausted
    throw lastError || new Error(tStatic('auth.retryFailed'));
  }, [router]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper to get auth headers for API calls
export function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
