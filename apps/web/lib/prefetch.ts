// Prefetch utilities - Preload data before navigation
// v1.0 - Initial implementation with SWR preload API

import { preload } from 'swr';
import { fetcher } from '@/contexts/SWRProvider';
import { getChinaToday, getChinaYesterday } from './date-utils';

/**
 * Prefetch dashboard page data
 * Preloads coverage, sentiment, and suggestions data
 */
export function prefetchDashboard(restaurantId: string) {
  const today = getChinaToday();
  const params = `restaurant_id=${restaurantId}&start_date=${today}&end_date=${today}`;

  // Preload main dashboard endpoints
  preload(`/api/dashboard/coverage?${params}`, fetcher);
  preload(`/api/dashboard/sentiment-summary?${params}`, fetcher);
  preload(`/api/dashboard/suggestions?restaurant_id=${restaurantId}&days=7`, fetcher);
  preload(`/api/action-items?${params}`, fetcher);
}

/**
 * Prefetch admin briefing page data
 * Preloads briefing, overview, and execution data
 */
export function prefetchAdminBriefing(managedIdsParam: string = '') {
  const yesterday = getChinaYesterday();
  const params = `start_date=${yesterday}&end_date=${yesterday}${managedIdsParam}`;

  // Preload admin briefing endpoints
  preload(`/api/dashboard/briefing?${params}`, fetcher);
  preload(`/api/dashboard/restaurants-overview?${params}`, fetcher);
  preload(`/api/dashboard/execution-overview?date=${yesterday}${managedIdsParam}`, fetcher);
  preload(`/api/dashboard/feedback-loop?${params}`, fetcher);
}

/**
 * Prefetch recorder page data
 * Preloads question templates and execution summary
 */
export function prefetchRecorder(restaurantId: string) {
  const yesterday = getChinaYesterday();

  // Preload recorder endpoints
  preload(`/api/question-templates/active?restaurant_id=${restaurantId}`, fetcher);
  preload(`/api/dashboard/execution-summary?restaurant_id=${restaurantId}&date=${yesterday}`, fetcher);
  preload(`/api/dashboard/motivation-stats?restaurant_id=${restaurantId}`, fetcher);
}

/**
 * Prefetch chat page data
 * Preloads chat sessions
 */
export function prefetchChat(restaurantId: string) {
  preload(`/api/chat/sessions?restaurant_id=${restaurantId}`, fetcher);
}

/**
 * Prefetch admin insights page data
 */
export function prefetchAdminInsights(managedIdsParam: string = '') {
  const today = getChinaToday();
  const params = `restaurant_id=all&start_date=${today}&end_date=${today}${managedIdsParam}`;

  preload(`/api/dashboard/sentiment-summary?${params}`, fetcher);
  preload(`/api/dashboard/suggestions?restaurant_id=all&start_date=${today}&end_date=${today}${managedIdsParam}`, fetcher);
}

/**
 * Prefetch admin meetings page data
 */
export function prefetchAdminMeetings(managedIdsParam: string = '') {
  preload(`/api/meeting/admin-overview?${managedIdsParam}`, fetcher);
}
