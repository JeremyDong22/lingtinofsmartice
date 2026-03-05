// Admin Overview Page - Greeting + 3-level ExecutionStatus + Metrics + Benchmark
// v4.0 - Redesign: unified brand→store→problem expandable replaces old store list

'use client';

import { useRef, useState, useCallback } from 'react';
import { CheckCircle } from 'lucide-react';
import useSWR from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { useManagedScope } from '@/hooks/useManagedScope';
import { UserMenu } from '@/components/layout/UserMenu';
import { BenchmarkPanel } from '@/components/admin/BenchmarkPanel';
import { ExecutionStatus } from '@/components/admin/ExecutionStatus';
import { getChinaYesterday, singleDay, dateRangeParams } from '@/lib/date-utils';
import type { DateRange } from '@/lib/date-utils';
import { DatePicker, useAdminPresets } from '@/components/shared/DatePicker';
import { useT } from '@/lib/i18n';

// --- Types ---
interface BriefingEvidence {
  text: string;
  tableId: string;
  audioUrl: string | null;
  managerQuestions?: string[];
  customerAnswers?: string[];
}

interface BriefingProblem {
  severity: 'red' | 'yellow';
  category: string;
  restaurantId: string;
  restaurantName: string;
  title: string;
  evidence: BriefingEvidence[];
  metric?: string;
}

interface BriefingResponse {
  date: string;
  greeting: string;
  problems: BriefingProblem[];
  healthy_count: number;
  restaurant_count: number;
  avg_sentiment: number | null;
  avg_coverage: number;
  avg_review_completion?: number;
}

interface RestaurantOverview {
  id: string;
  name: string;
  visit_count: number;
  open_count: number;
  coverage: number;
  avg_sentiment: number | null;
  keywords: string[];
  review_completion?: number;
  latest_review?: {
    ai_summary: string;
    action_items: unknown[];
    key_decisions: unknown[];
  } | null;
}

interface OverviewResponse {
  summary: {
    total_visits: number;
    avg_sentiment: number | null;
    restaurant_count: number;
  };
  restaurants: RestaurantOverview[];
  recent_keywords: string[];
}

interface ExecutionOverview {
  brands: Array<{
    brand_id: number | null;
    brand_name: string;
    restaurants: Array<{
      id: string;
      name: string;
      full_name: string;
      brand_id: number | null;
      brand_name: string | null;
      review_done: boolean;
      pending_actions: number;
      visit_count: number;
      avg_sentiment: number | null;
    }>;
    summary: { reviewed_count: number; total_count: number; total_pending: number };
  }>;
  restaurants: Array<{ id: string; name: string; review_done: boolean; pending_actions: number }>;
  summary: { reviewed_count: number; total_count: number; total_pending: number };
}

function getSatisfactionDisplay(score: number | null): { color: string; bg: string; label: string } {
  if (score === null) return { color: 'text-gray-400', bg: 'bg-gray-100', label: 'none' };
  if (score >= 70) return { color: 'text-green-600', bg: 'bg-green-100', label: 'positive' };
  if (score >= 50) return { color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'neutral' };
  return { color: 'text-red-600', bg: 'bg-red-100', label: 'negative' };
}

export default function AdminBriefingPage() {
  const { user } = useAuth();
  const { isScoped, managedIdsParam, storeCount } = useManagedScope();
  const { t, locale } = useT();
  const adminPresets = useAdminPresets();

  const yesterday = getChinaYesterday();

  // Date navigation
  const [dateRange, setDateRange] = useState<DateRange>(() => singleDay(yesterday));

  // Audio playback
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingKey(null);
  }, []);

  const handleAudioToggle = useCallback(
    (key: string, audioUrl: string) => {
      if (playingKey === key) {
        stopAudio();
        return;
      }
      stopAudio();
      const audio = new Audio(audioUrl);
      audio.onended = () => { setPlayingKey(null); audioRef.current = null; };
      audio.onerror = () => { setPlayingKey(null); audioRef.current = null; };
      audio.play();
      audioRef.current = audio;
      setPlayingKey(key);
    },
    [playingKey, stopAudio],
  );

  // Fetch briefing data (scoped by managed restaurants)
  const { data, isLoading } = useSWR<BriefingResponse>(`/api/dashboard/briefing?${dateRangeParams(dateRange)}${managedIdsParam}`);
  // Fetch overview data (keywords + store grid)
  const { data: overviewData } = useSWR<OverviewResponse>(`/api/dashboard/restaurants-overview?${dateRangeParams(dateRange)}${managedIdsParam}`);
  // Fetch customer profile data
  const { data: profileData } = useSWR<{
    summary: { repeat_ratio: number | null; data_coverage: number };
  }>(`/api/dashboard/customer-profile?${dateRangeParams(dateRange)}${managedIdsParam}`);

  // Fetch execution overview (always yesterday, independent of date picker)
  const { data: executionData } = useSWR<ExecutionOverview>(
    `/api/dashboard/execution-overview?date=${yesterday}${managedIdsParam}`
  );

  const userName = user?.employeeName || user?.username || (locale === 'en' ? 'there' : '您');
  const greetingMap: Record<string, string> = {
    '早安': t('briefing.greetingMorning'),
    '下午好': t('briefing.greetingAfternoon'),
    '晚上好': t('briefing.greetingEvening'),
  };
  const greeting = greetingMap[data?.greeting || ''] || data?.greeting || t('briefing.greetingMorning');
  const problems = data?.problems || [];
  const restaurantCount = data?.restaurant_count ?? 0;
  const avgSentiment = data?.avg_sentiment;
  const avgReviewCompletion = data?.avg_review_completion ?? 0;

  const summary = overviewData?.summary;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="island-header glass-nav px-[1.125rem] py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-gray-900">{t('briefing.title')}</h1>
          {isScoped && (
            <span className="text-xs bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full">
              {t('briefing.managingStores', storeCount ?? 0)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DatePicker
            value={dateRange}
            onChange={setDateRange}
            maxDate={yesterday}
            presets={adminPresets}
          />
          <UserMenu />
        </div>
      </header>

      <div className="px-4 py-4 space-y-4 island-page-top island-page-bottom">
        {/* Greeting banner */}
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {greeting}{locale === 'en' ? ', ' : '，'}{userName.slice(0, 3)}
          </h2>
          {!isLoading && problems.length > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">
              {t('briefing.storesAttention', restaurantCount, problems.length)}
            </p>
          )}
          {!isLoading && problems.length === 0 && restaurantCount > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">
              {t('briefing.storesHealthy', restaurantCount)}
            </p>
          )}
        </div>

        {/* 3-level ExecutionStatus (brand → store → problems) */}
        <ExecutionStatus
          executionData={executionData}
          problems={problems}
          overviewData={overviewData}
          onAudioToggle={handleAudioToggle}
          playingKey={playingKey}
        />

        {/* Compact metrics grid (2×2) */}
        {!isLoading && (
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card rounded-xl p-3 text-center">
              <div className="text-xs text-gray-500 mb-0.5">{t('briefing.satisfaction')}</div>
              <div className={`text-xl font-bold ${getSatisfactionDisplay(avgSentiment ?? null).color}`}>
                {avgSentiment != null ? t('briefing.score', Math.round(avgSentiment)) : '--'}
              </div>
              <div className="text-xs text-gray-400">
                {t('briefing.visits', summary?.total_visits ?? 0)}
              </div>
            </div>
            <div className="glass-card rounded-xl p-3 text-center">
              <div className="text-xs text-gray-500 mb-0.5">{t('briefing.coverage')}</div>
              <div className={`text-xl font-bold ${
                (data?.avg_coverage ?? 0) >= 60 ? 'text-green-600' :
                (data?.avg_coverage ?? 0) >= 30 ? 'text-yellow-600' :
                data?.avg_coverage != null ? 'text-red-600' :
                'text-gray-400'
              }`}>
                {data?.avg_coverage != null ? `${Math.round(data.avg_coverage)}%` : '--'}
              </div>
              <div className="text-xs text-gray-400">
                {t('briefing.stores', restaurantCount)}
              </div>
            </div>
            <div className="glass-card rounded-xl p-3 text-center">
              <div className="text-xs text-gray-500 mb-0.5">{t('briefing.reviewCompletion')}</div>
              <div className={`text-xl font-bold ${
                avgReviewCompletion >= 80 ? 'text-green-600' :
                avgReviewCompletion >= 50 ? 'text-yellow-600' :
                avgReviewCompletion >= 0 && data?.avg_review_completion != null ? 'text-red-600' :
                'text-gray-400'
              }`}>
                {data?.avg_review_completion != null ? `${Math.round(avgReviewCompletion)}%` : '--'}
              </div>
              <div className="text-xs text-gray-400">&nbsp;</div>
            </div>
            <div className="glass-card rounded-xl p-3 text-center">
              <div className="text-xs text-gray-500 mb-0.5">{t('briefing.repeatCustomer')}</div>
              {(() => {
                const ratio = profileData?.summary?.repeat_ratio;
                const coverage = profileData?.summary?.data_coverage ?? 0;
                const color = ratio == null ? 'text-gray-400'
                  : ratio >= 40 ? 'text-green-600'
                  : 'text-yellow-600';
                return (
                  <>
                    <div className={`text-xl font-bold ${color}`}>
                      {ratio != null ? `${ratio}%` : '--'}
                    </div>
                    <div className="text-xs text-gray-400">
                      {ratio != null && coverage < 80 ? t('briefing.basedOnData', coverage) : '\u00A0'}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                <div className="h-3 bg-gray-100 rounded w-4/5" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state - all healthy (only when no execution data either) */}
        {!isLoading && !executionData && restaurantCount > 0 && (
          <div className="glass-card rounded-xl p-6 text-center">
            <div className="flex justify-center mb-3"><CheckCircle className="w-10 h-10 text-green-400" /></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('briefing.allGood')}</h3>
            <p className="text-sm text-gray-500">
              {t('briefing.storesHealthy', restaurantCount)}
            </p>
          </div>
        )}

        {/* Benchmark panel (regional managers only) */}
        {isScoped && (
          <BenchmarkPanel managedIdsParam={managedIdsParam} />
        )}

        {/* Bottom spacing for nav */}
        <div className="h-4" />
      </div>
    </div>
  );
}
