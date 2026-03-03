// usePrefetchData - Prefetch critical API data on app entry for each role
// v1.0 - Warm SWR cache in background so page navigation feels instant

import { useEffect } from 'react';
import { mutate } from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { useManagedScope } from '@/hooks/useManagedScope';
import { getChinaToday, getChinaYesterday, dateRangeParams } from '@/lib/date-utils';
import { fetcher } from '@/contexts/SWRProvider';

type Role = 'manager' | 'admin' | 'chef';

// Build prefetch keys per role (same keys used by page-level useSWR)
function getPrefetchKeys(role: Role, restaurantId: string, managedIdsParam: string): string[] {
  const today = getChinaToday();
  const yesterday = getChinaYesterday();

  if (role === 'manager') {
    const params = `restaurant_id=${restaurantId}&start_date=${today}&end_date=${today}`;
    const yesterdayParams = `restaurant_id=${restaurantId}&start_date=${yesterday}&end_date=${yesterday}`;
    return [
      `/api/dashboard/coverage?${params}`,
      `/api/dashboard/sentiment-summary?${params}`,
      `/api/dashboard/sentiment-summary?${yesterdayParams}`,
      `/api/dashboard/speech-highlights?${params}`,
      `/api/dashboard/suggestions?restaurant_id=${restaurantId}&days=7`,
      `/api/action-items?restaurant_id=${restaurantId}&date=${today}`,
    ];
  }

  if (role === 'admin') {
    const rangeParams = dateRangeParams({ startDate: yesterday, endDate: yesterday });
    return [
      `/api/dashboard/briefing?${rangeParams}${managedIdsParam}`,
      `/api/dashboard/restaurants-overview?${rangeParams}${managedIdsParam}`,
      `/api/dashboard/customer-profile?${rangeParams}${managedIdsParam}`,
    ];
  }

  if (role === 'chef') {
    return [
      `/api/action-items?restaurant_id=${restaurantId}&date=${today}`,
      `/api/action-items?restaurant_id=${restaurantId}&date=${yesterday}`,
    ];
  }

  return [];
}

export function usePrefetchData(role: Role) {
  const { user } = useAuth();
  const { managedIdsParam } = useManagedScope();
  const restaurantId = user?.restaurantId || '';

  useEffect(() => {
    if (!user || !restaurantId) return;

    const keys = getPrefetchKeys(role, restaurantId, managedIdsParam);
    if (keys.length === 0) return;

    console.log(`[Prefetch] ${role} — warming ${keys.length} API keys`);
    const start = performance.now();

    // Fire all fetches in parallel, populate SWR cache silently
    const promises = keys.map(key =>
      mutate(key, fetcher(key), { revalidate: false })
        .then(() => console.log(`[Prefetch] [OK] ${key.split('?')[0]}`))
        .catch(err => console.warn(`[Prefetch] [FAIL] ${key.split('?')[0]}`, err.message))
    );

    Promise.allSettled(promises).then(() => {
      const elapsed = (performance.now() - start).toFixed(0);
      console.log(`[Prefetch] ${role} — done in ${elapsed}ms`);
    });
  }, [role, user, restaurantId, managedIdsParam]);
}
