// Dashboard Page - Business metrics and analytics
// v3.0 - Product-driven redesign: multi-dimension feedback,
//         emotion trend arrows, problem-first layout

'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { UserMenu } from '@/components/layout/UserMenu';
import { DailyReviewCard } from '@/components/dashboard/DailyReviewCard';
import { getChinaToday, singleDay, dateRangeParams, isMultiDay, shiftDate } from '@/lib/date-utils';
import type { DateRange } from '@/lib/date-utils';
import { DatePicker, useStorePresets } from '@/components/shared/DatePicker';
import { FeedbackSection } from '@/components/dashboard/FeedbackSection';
import { useT } from '@/lib/i18n';
import { getCacheConfig } from '@/contexts/SWRProvider';

// Types for API responses
interface CoveragePeriod {
  period: string;
  open_count: number;
  visit_count: number;
  coverage: number;
  status: 'good' | 'warning' | 'critical';
}

// Conversation context for feedback popover
interface FeedbackContext {
  text: string;
  visitId: string;
  tableId: string;
  managerQuestions: string[];
  customerAnswers: string[];
  transcript: string;
  audioUrl?: string | null;
}

interface SentimentFeedback {
  text: string;
  count: number;
  contexts?: FeedbackContext[];
}

interface SentimentSummary {
  positive_count: number;
  neutral_count: number;
  negative_count: number;
  positive_percent: number;
  neutral_percent: number;
  negative_percent: number;
  total_visits: number;
  positive_feedbacks: SentimentFeedback[];
  negative_feedbacks: SentimentFeedback[];
}

interface SuggestionItem {
  text: string;
  count: number;
  restaurants: string[];
  evidence: { tableId: string; audioUrl: string | null; restaurantName: string; restaurantId: string }[];
}

interface SuggestionsResponse {
  suggestions: SuggestionItem[];
}

interface ReviewCompletion {
  total_days: number;
  reviewed_days: number;
  completion_rate: number;
  streak: number;
}

// Response types for SWR
interface CoverageResponse {
  periods: CoveragePeriod[];
  review_completion?: ReviewCompletion | null;
}

export default function DashboardPage() {
  const { t } = useT();
  const storePresets = useStorePresets();
  const [dateRange, setDateRange] = useState<DateRange>(() => singleDay(getChinaToday()));
  // Get user's restaurant ID from auth context
  const { user } = useAuth();
  const restaurantId = user?.restaurantId;

  // Build query params for API calls
  const rangeQs = dateRangeParams(dateRange);
  const params = restaurantId
    ? `restaurant_id=${restaurantId}&${rangeQs}`
    : null;

  // Whether this is a multi-day range (hides trend arrows)
  const multiDay = isMultiDay(dateRange);

  // Build yesterday's params for trend comparison (only when single day)
  const yesterdayDate = shiftDate(dateRange.startDate, -1);
  const yesterdayParams = restaurantId && !multiDay
    ? `restaurant_id=${restaurantId}&start_date=${yesterdayDate}&end_date=${yesterdayDate}`
    : null;

  // SWR hooks for data fetching with optimized cache strategies
  // Today's data: 30s cache, historical: 5min, statistics: 10min
  const { data: coverageData, isLoading: coverageLoading } = useSWR<CoverageResponse>(
    params ? `/api/dashboard/coverage?${params}` : null,
    { ...getCacheConfig('realtime') }
  );
  const { data: sentimentData, isLoading: sentimentLoading } = useSWR<SentimentSummary>(
    params ? `/api/dashboard/sentiment-summary?${params}` : null,
    { ...getCacheConfig('realtime') }
  );
  const { data: yesterdaySentiment } = useSWR<SentimentSummary>(
    yesterdayParams ? `/api/dashboard/sentiment-summary?${yesterdayParams}` : null,
    { ...getCacheConfig('historical') }
  );
  const { data: suggestionsData } = useSWR<SuggestionsResponse>(
    restaurantId ? `/api/dashboard/suggestions?restaurant_id=${restaurantId}&days=7` : null,
    { ...getCacheConfig('statistics') }
  );

  // Kitchen action items (dish_quality category) — use endDate for single-day, today for range
  const kitchenActionsDate = dateRange.startDate === dateRange.endDate ? dateRange.endDate : getChinaToday();
  const kitchenActionsParams = restaurantId
    ? `restaurant_id=${restaurantId}&date=${kitchenActionsDate}`
    : null;
  const { data: kitchenActionsData } = useSWR<{ actions: { id: string; category: string; suggestion_text: string; status: string; response_note?: string | null; priority: string }[] }>(
    kitchenActionsParams ? `/api/action-items?${kitchenActionsParams}` : null,
    { ...getCacheConfig('statistics') }
  );

  // Derived data with defaults
  const coverage = coverageData ?? { periods: [] };
  const reviewCompletion = coverageData?.review_completion;
  const sentiment = sentimentData ?? null;
  const suggestions = suggestionsData?.suggestions ?? [];
  const kitchenActions = (kitchenActionsData?.actions ?? []).filter(a => a.category === 'dish_quality');
  const loading = coverageLoading || sentimentLoading;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="island-header glass-nav px-[1.125rem] py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">{t('dashboard.title')}</h1>
        <div className="flex items-center gap-2">
          <DatePicker
            value={dateRange}
            onChange={setDateRange}
            maxDate={getChinaToday()}
            presets={storePresets}
          />
          <UserMenu />
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 island-page-top island-page-bottom">
        {/* Loading indicator - with keepPreviousData, show subtle overlay instead of skeleton */}
        {loading && !coverageData && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-card rounded-2xl p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                <div className="h-3 bg-gray-100 rounded w-4/5" />
              </div>
            ))}
          </div>
        )}

        {/* Content with loading overlay when revalidating */}
        <div className={`space-y-4 transition-opacity duration-200 ${loading && coverageData ? 'opacity-60' : ''}`}>

        {/* Execution Data Card */}
        <div className="glass-card rounded-2xl p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">{t('dashboard.execution')}</h2>
          <div className="grid grid-cols-3 gap-3">
            {/* Visit counts by period */}
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">{t('dashboard.visits')}</div>
              <div className="text-xl font-bold text-gray-900">
                {coverage.periods.reduce((sum, p) => sum + p.visit_count, 0)}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                {coverage.periods.map(p =>
                  `${p.period === 'lunch' ? t('dashboard.lunch') : t('dashboard.dinner')}${p.visit_count}`
                ).join(' · ') || '--'}
              </div>
            </div>
            {/* Review completion rate */}
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">{t('dashboard.reviewLabel')}</div>
              <div className={`text-xl font-bold ${
                !reviewCompletion ? 'text-gray-400' :
                reviewCompletion.completion_rate >= 80 ? 'text-green-600' :
                reviewCompletion.completion_rate >= 50 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {reviewCompletion ? `${reviewCompletion.completion_rate}%` : '--'}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                {reviewCompletion ? t('dashboard.reviewDays', reviewCompletion.reviewed_days, reviewCompletion.total_days) : '--'}
              </div>
            </div>
            {/* Streak */}
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">{t('dashboard.consecutive')}</div>
              <div className={`text-xl font-bold ${
                !reviewCompletion ? 'text-gray-400' :
                reviewCompletion.streak >= 5 ? 'text-green-600' :
                reviewCompletion.streak >= 3 ? 'text-yellow-600' :
                'text-gray-600'
              }`}>
                {reviewCompletion ? `${reviewCompletion.streak}天` : '--'}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">&nbsp;</div>
            </div>
          </div>
        </div>

        {/* Sentiment Summary with Trend Arrows */}
        <div className="glass-card rounded-2xl p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">{t('dashboard.satisfactionOverview')}</h2>
          {sentiment ? (
            <div className="flex items-center justify-around py-4">
              {[
                { label: t('dashboard.satisfied'), pct: sentiment.positive_percent, prevPct: yesterdaySentiment?.positive_percent, color: 'text-green-600', trendUp: 'text-green-500', trendDown: 'text-red-500' },
                { label: t('dashboard.neutral'), pct: sentiment.neutral_percent, prevPct: yesterdaySentiment?.neutral_percent, color: 'text-gray-600', trendUp: 'text-gray-500', trendDown: 'text-gray-500' },
                { label: t('dashboard.unsatisfied'), pct: sentiment.negative_percent, prevPct: yesterdaySentiment?.negative_percent, color: 'text-red-500', trendUp: 'text-red-500', trendDown: 'text-green-500' },
              ].map((item, i) => {
                const diff = !multiDay && item.prevPct != null ? item.pct - item.prevPct : null;
                return (
                  <div key={i} className="text-center flex-1">
                    <div className={`text-3xl font-bold ${item.color}`}>{item.pct}%</div>
                    <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
                    {diff !== null && diff !== 0 && (
                      <div className={`text-xs mt-0.5 font-medium ${
                        i === 2 ? (diff > 0 ? item.trendUp : item.trendDown) : (diff > 0 ? item.trendUp : item.trendDown)
                      }`}>
                        {diff > 0 ? '↑' : '↓'} {Math.abs(diff)}%
                        <span className="text-gray-400 font-normal ml-0.5">{t('dashboard.vsPrevDay')}</span>
                      </div>
                    )}
                    {diff === 0 && (
                      <div className="text-xs mt-0.5 text-gray-400">{t('dashboard.noChange')}</div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : !loading ? (
            <div className="text-center py-4 text-gray-400">{t('dashboard.noData')}</div>
          ) : null}
        </div>

        {/* Customer Feedback - aligned with admin insights style */}
        <FeedbackSection
          negativeFeedbacks={sentiment?.negative_feedbacks ?? []}
          positiveFeedbacks={sentiment?.positive_feedbacks ?? []}
          suggestions={suggestions}
          loading={loading}
        />

        {/* Kitchen Response Section */}
        {kitchenActions.length > 0 && (
          <div className="glass-card rounded-2xl p-4">
            <h2 className="text-sm font-medium text-gray-700 mb-3">{t('dashboard.kitchenResponse')}</h2>
            <div className="space-y-3">
              {kitchenActions.map((item) => {
                const isResolved = item.status === 'resolved';
                const isDismissed = item.status === 'dismissed';
                return (
                  <div key={item.id} className={`rounded-2xl p-4 ${
                    isResolved ? 'bg-green-50 border border-green-100' :
                    isDismissed ? 'bg-gray-50 border border-gray-100' :
                    'bg-red-50/50 border border-red-100'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        isResolved ? 'bg-green-500' :
                        isDismissed ? 'bg-gray-400' :
                        'bg-red-500'
                      }`} />
                      <span className={`text-xs font-medium ${
                        isResolved ? 'text-green-700' :
                        isDismissed ? 'text-gray-500' :
                        'text-red-700'
                      }`}>
                        {isResolved ? t('dashboard.processed') : isDismissed ? t('dashboard.ignored') : t('dashboard.pending')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{item.suggestion_text}</p>
                    {item.response_note && (
                      <div className="mt-1.5 text-xs text-green-700 bg-green-50 rounded-lg px-2 py-1">
                        {t('dashboard.chefLabel')}{item.response_note}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {kitchenActions.filter(a => a.status === 'pending' || a.status === 'acknowledged').length > 0 && (
              <div className="mt-2 text-xs text-gray-400 text-center">
                {t('dashboard.pendingDishes', kitchenActions.filter(a => a.status === 'pending' || a.status === 'acknowledged').length)}
              </div>
            )}
          </div>
        )}

        {/* Daily Review - meeting summary + action items */}
        {restaurantId && !multiDay && (
          <DailyReviewCard
            restaurantId={restaurantId}
            date={dateRange.endDate}
            negativeCount={sentiment?.negative_count ?? 0}
          />
        )}
        </div>
      </main>

    </div>
  );
}
