// Dashboard Page - Business metrics and analytics
// v3.0 - Product-driven redesign: multi-dimension feedback, speech quality split,
//         emotion trend arrows, problem-first layout

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { UserMenu } from '@/components/layout/UserMenu';
import { ActionItemsCard } from '@/components/dashboard/ActionItemsCard';
import { getChinaToday, singleDay, dateRangeParams, isMultiDay, shiftDate } from '@/lib/date-utils';
import type { DateRange } from '@/lib/date-utils';
import { DatePicker, useStorePresets } from '@/components/shared/DatePicker';
import { FeedbackSection } from '@/components/dashboard/FeedbackSection';
import { useT } from '@/lib/i18n';

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

interface ManagerQuestion {
  text: string;
  table: string;
  time: string;
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

interface HighlightsResponse {
  questions: ManagerQuestion[];
}

// Classify speech questions as good or needs-improvement
function classifySpeech(text: string): 'good' | 'improve' {
  // Too vague or open-ended → needs improvement
  if (/^(还满意吗|满意吗|还好吗|还行吗|有什么建议|有什么意见|可以吗)\?*[？]?$/.test(text.trim())) return 'improve';
  if (text.length < 6) return 'improve';
  // Specific and targeted → good
  if (/怎么样|觉得|口味|速度|推荐|招牌|特色|第几次/.test(text)) return 'good';
  return 'good'; // default to good if not clearly vague
}

// Speech quality reasons
function getSpeechReason(text: string, quality: 'good' | 'improve'): string {
  if (quality === 'improve') {
    if (/满意/.test(text)) return '太笼统，顾客只会说"还行"';
    if (/建议|意见/.test(text)) return '开放式，顾客不知从何答起';
    return '话术过短，难以引导深度反馈';
  }
  if (/怎么样/.test(text)) return '精准定位问题，引出真实反馈';
  if (/推荐|招牌|特色/.test(text)) return '顾客积极回应，获得有效反馈';
  if (/速度|上菜/.test(text)) return '定向服务问题，获得直接回答';
  if (/第几次/.test(text)) return '建立关系，了解客户忠诚度';
  return '针对性提问，获得有效反馈';
}

// Speech quality split component
function SpeechQualitySplit({ questions }: { questions: ManagerQuestion[] }) {
  const { t } = useT();
  const good = questions.filter(q => classifySpeech(q.text) === 'good');
  const improve = questions.filter(q => classifySpeech(q.text) === 'improve');

  return (
    <div className="space-y-4">
      {good.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-xs font-semibold text-gray-600">{t('dashboard.goodExample')}</span>
          </div>
          <div className="space-y-2">
            {good.slice(0, 3).map((q, i) => (
              <div key={i} className="bg-green-50/60 rounded-lg p-3">
                <div className="text-sm text-green-800 font-medium">&ldquo;{q.text}&rdquo;</div>
                <div className="text-xs text-green-600 mt-1">→ {getSpeechReason(q.text, 'good')}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {improve.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-xs font-semibold text-gray-600">{t('dashboard.canImprove')}</span>
          </div>
          <div className="space-y-2">
            {improve.slice(0, 3).map((q, i) => (
              <div key={i} className="bg-amber-50/60 rounded-lg p-3">
                <div className="text-sm text-amber-800 font-medium">&ldquo;{q.text}&rdquo;</div>
                <div className="text-xs text-amber-600 mt-1">→ {getSpeechReason(q.text, 'improve')}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
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

  // SWR hooks for data fetching with stale-while-revalidate
  const { data: coverageData, isLoading: coverageLoading } = useSWR<CoverageResponse>(
    params ? `/api/dashboard/coverage?${params}` : null
  );
  const { data: sentimentData, isLoading: sentimentLoading } = useSWR<SentimentSummary>(
    params ? `/api/dashboard/sentiment-summary?${params}` : null
  );
  const { data: yesterdaySentiment } = useSWR<SentimentSummary>(
    yesterdayParams ? `/api/dashboard/sentiment-summary?${yesterdayParams}` : null
  );
  const { data: highlightsData, isLoading: highlightsLoading } = useSWR<HighlightsResponse>(
    params ? `/api/dashboard/speech-highlights?${params}` : null
  );
  const { data: suggestionsData } = useSWR<SuggestionsResponse>(
    restaurantId ? `/api/dashboard/suggestions?restaurant_id=${restaurantId}&days=7` : null
  );

  // Kitchen action items (dish_quality category) — use endDate for single-day, today for range
  const kitchenActionsDate = dateRange.startDate === dateRange.endDate ? dateRange.endDate : getChinaToday();
  const kitchenActionsParams = restaurantId
    ? `restaurant_id=${restaurantId}&date=${kitchenActionsDate}`
    : null;
  const { data: kitchenActionsData } = useSWR<{ actions: { id: string; category: string; suggestion_text: string; status: string; response_note?: string | null; priority: string }[] }>(
    kitchenActionsParams ? `/api/action-items?${kitchenActionsParams}` : null
  );

  // Derived data with defaults
  const coverage = coverageData ?? { periods: [] };
  const reviewCompletion = coverageData?.review_completion;
  const sentiment = sentimentData ?? null;
  const managerQuestions = highlightsData?.questions ?? [];
  const suggestions = suggestionsData?.suggestions ?? [];
  const kitchenActions = (kitchenActionsData?.actions ?? []).filter(a => a.category === 'dish_quality');
  const loading = coverageLoading || sentimentLoading || highlightsLoading;

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
        {/* Loading indicator */}
        {loading && (
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

        {/* Manager Questions - 话术使用 (split into good/bad) */}
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-700">{t('dashboard.speechUsage')}</h2>
            <button
              onClick={() => {
                const question = '请你获取我们最近的桌台访问的话术并且以专业餐饮经营者的角度，告诉我该如何优化这些话术，以获得更好的效果';
                router.push(`/chat?q=${encodeURIComponent(question)}`);
              }}
              className="group relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <span className="absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,#8b5cf6,45%,#c084fc,55%,#8b5cf6)] bg-[length:200%_100%]" />
              <span className="relative flex items-center gap-1.5 text-white">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
                </svg>
                <span>{t('dashboard.aiOptimize')}</span>
              </span>
            </button>
          </div>
          {managerQuestions.length > 0 ? (
            <SpeechQualitySplit questions={managerQuestions} />
          ) : !loading ? (
            <div className="text-center py-4 text-gray-400 text-sm">{t('dashboard.noData')}</div>
          ) : null}
        </div>

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

        {/* AI Action Items */}
        {restaurantId && (
          <ActionItemsCard restaurantId={restaurantId} date={dateRange.endDate} />
        )}
      </main>

    </div>
  );
}
