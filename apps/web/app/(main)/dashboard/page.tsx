// Dashboard Page - Business metrics and analytics
// v3.0 - Product-driven redesign: multi-dimension feedback, speech quality split,
//         emotion trend arrows, problem-first layout

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { UserMenu } from '@/components/layout/UserMenu';
import { ActionItemsCard } from '@/components/dashboard/ActionItemsCard';
import { getChinaToday, singleDay, dateRangeParams, isMultiDay, shiftDate } from '@/lib/date-utils';
import type { DateRange } from '@/lib/date-utils';
import { DatePicker, storePresets } from '@/components/shared/DatePicker';
import { Timer, Meh, Home, SmilePlus, UtensilsCrossed, CheckCircle } from 'lucide-react';

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

// Detect feedback category icon from text
function DetectCategoryIcon({ text }: { text: string }) {
  const lower = text.toLowerCase();
  const cls = "w-4 h-4 inline-block align-text-bottom mr-0.5";
  if (/慢|等了|催|久|速度|出菜/.test(lower)) return <Timer className={cls} />;
  if (/态度|不耐烦|冷淡|不理|脸色/.test(lower)) return <Meh className={cls} />;
  if (/环境|吵|脏|热|冷|味道大|苍蝇/.test(lower)) return <Home className={cls} />;
  if (/服务/.test(lower)) return <SmilePlus className={cls} />;
  return <UtensilsCrossed className={cls} />;
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
  const good = questions.filter(q => classifySpeech(q.text) === 'good');
  const improve = questions.filter(q => classifySpeech(q.text) === 'improve');

  return (
    <div className="space-y-4">
      {good.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-xs font-semibold text-gray-600">优秀示范</span>
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
            <span className="text-xs font-semibold text-gray-600">可以更好</span>
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
  const [dateRange, setDateRange] = useState<DateRange>(() => singleDay(getChinaToday()));
  // State for feedback popover
  const [selectedFeedback, setSelectedFeedback] = useState<{
    feedback: SentimentFeedback;
    type: 'positive' | 'negative';
    rect: DOMRect;
  } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  // Audio playback state for feedback popover
  const [playingVisitId, setPlayingVisitId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingVisitId(null);
  }, []);

  const handleAudioToggle = useCallback((visitId: string, audioUrl: string) => {
    // If same audio is playing, pause it
    if (playingVisitId === visitId) {
      stopAudio();
      return;
    }
    // Stop any currently playing audio
    stopAudio();
    // Play new audio
    const audio = new Audio(audioUrl);
    audio.onended = () => {
      setPlayingVisitId(null);
      audioRef.current = null;
    };
    audio.onerror = () => {
      setPlayingVisitId(null);
      audioRef.current = null;
    };
    audio.play();
    audioRef.current = audio;
    setPlayingVisitId(visitId);
  }, [playingVisitId, stopAudio]);

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

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        stopAudio();
        setSelectedFeedback(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [stopAudio]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">数据看板</h1>
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

      <main className="p-4 space-y-4">
        {/* Loading indicator */}
        {loading && (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        )}

        {/* Execution Data Card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-medium text-gray-700 mb-3">执行数据</h2>
          <div className="grid grid-cols-3 gap-3">
            {/* Visit counts by period */}
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">桌访</div>
              <div className="text-xl font-bold text-gray-900">
                {coverage.periods.reduce((sum, p) => sum + p.visit_count, 0)}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                {coverage.periods.map(p =>
                  `${p.period === 'lunch' ? '午' : '晚'}${p.visit_count}`
                ).join(' · ') || '--'}
              </div>
            </div>
            {/* Review completion rate */}
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">复盘</div>
              <div className={`text-xl font-bold ${
                !reviewCompletion ? 'text-gray-400' :
                reviewCompletion.completion_rate >= 80 ? 'text-green-600' :
                reviewCompletion.completion_rate >= 50 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {reviewCompletion ? `${reviewCompletion.completion_rate}%` : '--'}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                {reviewCompletion ? `${reviewCompletion.reviewed_days}/${reviewCompletion.total_days}天` : '--'}
              </div>
            </div>
            {/* Streak */}
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">连续复盘</div>
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
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-medium text-gray-700 mb-3">满意度概览</h2>
          {sentiment ? (
            <div className="flex items-center justify-around py-4">
              {[
                { label: '满意', pct: sentiment.positive_percent, prevPct: yesterdaySentiment?.positive_percent, color: 'text-green-600', trendUp: 'text-green-500', trendDown: 'text-red-500' },
                { label: '一般', pct: sentiment.neutral_percent, prevPct: yesterdaySentiment?.neutral_percent, color: 'text-gray-600', trendUp: 'text-gray-500', trendDown: 'text-gray-500' },
                { label: '不满意', pct: sentiment.negative_percent, prevPct: yesterdaySentiment?.negative_percent, color: 'text-red-500', trendUp: 'text-red-500', trendDown: 'text-green-500' },
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
                        <span className="text-gray-400 font-normal ml-0.5">比昨天</span>
                      </div>
                    )}
                    {diff === 0 && (
                      <div className="text-xs mt-0.5 text-gray-400">— 持平</div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : !loading ? (
            <div className="text-center py-4 text-gray-400">暂无数据</div>
          ) : null}
        </div>

        {/* Customer Feedback - Multi-dimension (problems first, then highlights) */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-medium text-gray-700 mb-3">顾客反馈</h2>
          {sentiment && (sentiment.negative_feedbacks?.length > 0 || sentiment.positive_feedbacks?.length > 0) ? (
            <>
              {/* Problems section */}
              {sentiment.negative_feedbacks?.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    <span className="text-xs font-semibold text-gray-600">需要改进</span>
                  </div>
                  <div className="space-y-2">
                    {sentiment.negative_feedbacks.map((fb, i) => {
                      const icon = <DetectCategoryIcon text={fb.text} />;
                      return (
                        <button
                          key={i}
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setSelectedFeedback({ feedback: fb, type: 'negative', rect });
                          }}
                          className="w-full text-left bg-red-50/60 rounded-lg p-3 hover:bg-red-50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-800">
                              {icon} {fb.text}
                            </span>
                            <span className="flex items-center gap-1 text-xs font-semibold text-red-500 bg-red-100 px-2 py-0.5 rounded-full">
                              <span className={`w-1.5 h-1.5 rounded-full ${fb.count >= 3 ? 'bg-red-500' : 'bg-amber-400'}`} />
                              {fb.count}桌
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Positive highlights */}
              {sentiment.positive_feedbacks?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    <span className="text-xs font-semibold text-gray-600">值得保持</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {sentiment.positive_feedbacks.map((fb, i) => {
                      const icon = <DetectCategoryIcon text={fb.text} />;
                      return (
                        <button
                          key={i}
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setSelectedFeedback({ feedback: fb, type: 'positive', rect });
                          }}
                          className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                        >
                          {icon} {fb.text} {fb.count > 1 && <span className="ml-1 text-green-500">{fb.count}桌</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* No negative feedbacks but has positive */}
              {(!sentiment.negative_feedbacks || sentiment.negative_feedbacks.length === 0) && (
                <div className="flex items-center gap-2 text-green-600 mb-3 bg-green-50 rounded-lg p-3">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">今日无需特别关注的问题</span>
                </div>
              )}

              {/* Customer suggestions */}
              {suggestions.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <span className="text-xs font-semibold text-gray-600">顾客建议</span>
                    <span className="text-xs text-gray-400 ml-auto">近 7 天</span>
                  </div>
                  <div className="space-y-1.5">
                    {suggestions.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-purple-50/60 rounded-lg px-3 py-2"
                      >
                        <span className="text-sm text-gray-800">&ldquo;{item.text}&rdquo;</span>
                        {item.count > 1 && (
                          <span className="flex-shrink-0 text-xs font-semibold text-purple-600 ml-2">
                            ×{item.count}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : !loading ? (
            <div className="text-center py-4 text-gray-400">暂无反馈数据</div>
          ) : null}
        </div>

        {/* Manager Questions - 话术使用 (split into good/bad) */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-700">话术使用</h2>
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
                <span>AI 优化</span>
              </span>
            </button>
          </div>
          {managerQuestions.length > 0 ? (
            <SpeechQualitySplit questions={managerQuestions} />
          ) : !loading ? (
            <div className="text-center py-4 text-gray-400 text-sm">暂无数据</div>
          ) : null}
        </div>

        {/* Kitchen Response Section */}
        {kitchenActions.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h2 className="text-sm font-medium text-gray-700 mb-3">厨房响应</h2>
            <div className="space-y-3">
              {kitchenActions.map((item) => {
                const isResolved = item.status === 'resolved';
                const isDismissed = item.status === 'dismissed';
                return (
                  <div key={item.id} className={`rounded-xl p-3 ${
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
                        {isResolved ? '已处理' : isDismissed ? '已忽略' : '待处理'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{item.suggestion_text}</p>
                    {item.response_note && (
                      <div className="mt-1.5 text-xs text-green-700 bg-green-50 rounded px-2 py-1">
                        厨师长: {item.response_note}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {kitchenActions.filter(a => a.status === 'pending' || a.status === 'acknowledged').length > 0 && (
              <div className="mt-2 text-xs text-gray-400 text-center">
                {kitchenActions.filter(a => a.status === 'pending' || a.status === 'acknowledged').length} 个菜品问题待厨师长处理
              </div>
            )}
          </div>
        )}

        {/* AI Action Items */}
        {restaurantId && (
          <ActionItemsCard restaurantId={restaurantId} date={dateRange.endDate} />
        )}
      </main>

      {/* Feedback Conversation Popover */}
      {selectedFeedback && (() => {
        // Shift strategy: keep popover within viewport with 16px padding
        const popoverWidth = 320; // w-80 = 320px
        const padding = 16;
        const viewportWidth = window.innerWidth;

        // Try to center below the bubble, then shift to stay in bounds
        const bubbleCenter = selectedFeedback.rect.left + selectedFeedback.rect.width / 2;
        let left = bubbleCenter - popoverWidth / 2;

        // Shift right if overflowing left edge
        if (left < padding) {
          left = padding;
        }
        // Shift left if overflowing right edge
        if (left + popoverWidth > viewportWidth - padding) {
          left = viewportWidth - popoverWidth - padding;
        }

        return (
          <div
            ref={popoverRef}
            className="fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 w-80 animate-in fade-in zoom-in-95 duration-200"
            style={{
              top: Math.min(selectedFeedback.rect.bottom + 8, window.innerHeight - 300),
              left,
            }}
          >
          {/* Close button */}
          <button
            onClick={() => { stopAudio(); setSelectedFeedback(null); }}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Header with feedback text highlighted */}
          <div className={`inline-block px-2 py-1 rounded-full text-sm font-medium mb-3 ${
            selectedFeedback.type === 'positive'
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-700'
          }`}>
            {selectedFeedback.feedback.text}
          </div>

          {/* Conversation contexts */}
          {selectedFeedback.feedback.contexts && selectedFeedback.feedback.contexts.length > 0 ? (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {selectedFeedback.feedback.contexts.map((ctx, idx) => (
                <div key={idx} className="border-l-2 border-primary-200 pl-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">{ctx.tableId}桌</span>
                    {ctx.audioUrl && (
                      <button
                        onClick={() => handleAudioToggle(ctx.visitId, ctx.audioUrl!)}
                        className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                      >
                        {playingVisitId === ctx.visitId ? (
                          <svg className="w-3 h-3 text-gray-600" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                        ) : (
                          <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Q&A conversation */}
                  {ctx.managerQuestions.length > 0 && (
                    <div className="flex gap-2 mb-1">
                      <span className="w-7 text-right text-[10px] text-gray-400 pt-0.5 flex-shrink-0">店长</span>
                      <p className="text-sm text-gray-600">{ctx.managerQuestions.join(' ')}</p>
                    </div>
                  )}
                  {ctx.customerAnswers.length > 0 && (
                    <div className="flex gap-2">
                      <span className="w-7 text-right text-[10px] text-gray-400 pt-0.5 flex-shrink-0">顾客</span>
                      <p className="text-sm text-gray-800">
                        {ctx.customerAnswers.map((answer, ansIdx) => {
                          const keyword = selectedFeedback.feedback.text;
                          const parts = answer.split(new RegExp(`(${keyword})`, 'gi'));
                          return (
                            <span key={ansIdx}>
                              {parts.map((part, partIdx) =>
                                part.toLowerCase() === keyword.toLowerCase() ? (
                                  <mark
                                    key={partIdx}
                                    className={`px-0.5 rounded ${
                                      selectedFeedback.type === 'positive'
                                        ? 'bg-green-200'
                                        : 'bg-red-200'
                                    }`}
                                  >
                                    {part}
                                  </mark>
                                ) : (
                                  <span key={partIdx}>{part}</span>
                                )
                              )}
                              {ansIdx < ctx.customerAnswers.length - 1 && ' '}
                            </span>
                          );
                        })}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-400 text-center py-2">
              暂无对话详情
            </div>
          )}
        </div>
        );
      })()}
    </div>
  );
}
