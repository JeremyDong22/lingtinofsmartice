// Bottom Navigation Component - Navigation between main pages
// v1.2 - Added prefetching on hover/touch for faster navigation

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useT } from '@/lib/i18n';
import { prefetchDashboard, prefetchRecorder, prefetchChat } from '@/lib/prefetch';

const NAV_ITEMS = [
  {
    href: '/chat',
    labelKey: 'nav.chat',
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    href: '/recorder',
    labelKey: 'nav.recorder',
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
  },
  {
    href: '/dashboard',
    labelKey: 'nav.dashboard',
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useT();
  const { user } = useAuth();
  const restaurantId = user?.restaurantId || '';

  // Prefetch handlers for each route
  const handlePrefetch = (href: string) => {
    if (!restaurantId) return;

    switch (href) {
      case '/dashboard':
        prefetchDashboard(restaurantId);
        break;
      case '/recorder':
        prefetchRecorder(restaurantId);
        break;
      case '/chat':
        prefetchChat(restaurantId);
        break;
    }
  };

  return (
    <nav className="island-bottom-nav glass-nav">
      <div className="flex items-center justify-around h-14">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-all touch-manipulation ${
                isActive ? 'text-primary-600' : 'text-gray-400 active:scale-90 active:opacity-60'
              }`}
              onMouseEnter={() => handlePrefetch(item.href)}
              onTouchStart={() => handlePrefetch(item.href)}
            >
              {item.icon(isActive)}
              <span className="text-xs mt-1 font-medium">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
