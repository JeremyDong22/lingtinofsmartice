// ExecutionStatus - 3-level expandable: Brand → Store → Problem detail
// Single brand → skip brand layer, show stores directly

'use client';

import { useState, useCallback, Fragment } from 'react';
import { useRouter } from 'next/navigation';
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

interface BrandRestaurant {
  id: string;
  name: string;
  full_name: string;
  brand_id: number | null;
  brand_name: string | null;
  review_done: boolean;
  pending_actions: number;
  visit_count: number;
  avg_sentiment: number | null;
}

interface BrandGroup {
  brand_id: number | null;
  brand_name: string;
  restaurants: BrandRestaurant[];
  summary: {
    reviewed_count: number;
    total_count: number;
    total_pending: number;
  };
}

interface ExecutionOverview {
  brands: BrandGroup[];
  restaurants: Array<{ id: string; name: string; review_done: boolean; pending_actions: number }>;
  summary: {
    reviewed_count: number;
    total_count: number;
    total_pending: number;
  };
}

interface RestaurantOverview {
  id: string;
  name: string;
  visit_count: number;
  avg_sentiment: number | null;
  review_completion?: number;
  latest_review?: {
    ai_summary: string;
    action_items: unknown[];
    key_decisions: unknown[];
  } | null;
}

interface OverviewResponse {
  restaurants: RestaurantOverview[];
}

interface ExecutionStatusProps {
  executionData: ExecutionOverview | undefined;
  problems: BriefingProblem[];
  overviewData: OverviewResponse | undefined;
  onAudioToggle: (key: string, url: string) => void;
  playingKey: string | null;
}

function getStoreStatusColor(r: { review_done: boolean; pending_actions: number }): { dot: string; order: number } {
  if (!r.review_done && r.pending_actions > 0) return { dot: 'bg-red-500', order: 0 };
  if (!r.review_done) return { dot: 'bg-yellow-400', order: 1 };
  return { dot: 'bg-green-500', order: 2 };
}

// Chevron icon
function Chevron({ expanded, className = '' }: { expanded: boolean; className?: string }) {
  return (
    <svg
      className={`w-4 h-4 text-gray-300 transition-transform duration-200 flex-shrink-0 ${expanded ? 'rotate-90' : ''} ${className}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function ExecutionStatus({ executionData, problems, overviewData, onAudioToggle, playingKey }: ExecutionStatusProps) {
  const { t } = useT();
  const router = useRouter();

  const [expandedBrands, setExpandedBrands] = useState<Set<number | null>>(new Set());
  const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set());

  const toggleBrand = useCallback((brandId: number | null) => {
    setExpandedBrands(prev => {
      const next = new Set(prev);
      if (next.has(brandId)) next.delete(brandId);
      else next.add(brandId);
      return next;
    });
  }, []);

  const toggleStore = useCallback((storeId: string) => {
    setExpandedStores(prev => {
      const next = new Set(prev);
      if (next.has(storeId)) next.delete(storeId);
      else next.add(storeId);
      return next;
    });
  }, []);

  if (!executionData || executionData.brands.length === 0) return null;

  const { brands, summary } = executionData;
  const singleBrand = brands.length === 1;

  // Group problems by restaurantId
  const problemsByRestaurant = new Map<string, BriefingProblem[]>();
  for (const p of problems) {
    const existing = problemsByRestaurant.get(p.restaurantId) || [];
    existing.push(p);
    problemsByRestaurant.set(p.restaurantId, existing);
  }

  // Overview data by restaurant ID (for latest_review)
  const overviewByRestaurant = new Map<string, RestaurantOverview>();
  for (const r of (overviewData?.restaurants || [])) {
    overviewByRestaurant.set(r.id, r);
  }

  // Sort brands: not-all-reviewed first
  const sortedBrands = [...brands].sort((a, b) => {
    const aAllDone = a.summary.reviewed_count === a.summary.total_count;
    const bAllDone = b.summary.reviewed_count === b.summary.total_count;
    if (aAllDone !== bAllDone) return aAllDone ? 1 : -1;
    return b.summary.total_pending - a.summary.total_pending;
  });

  // Sort stores: red → yellow → green
  function sortStores(stores: BrandRestaurant[]) {
    return [...stores].sort((a, b) => {
      const aStatus = getStoreStatusColor(a);
      const bStatus = getStoreStatusColor(b);
      if (aStatus.order !== bStatus.order) return aStatus.order - bStatus.order;
      return b.pending_actions - a.pending_actions;
    });
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">{t('execution.yesterdayExecution')}</h3>
        <div className="text-xs text-gray-500">
          {t('execution.reviewCount', summary.reviewed_count, summary.total_count)}
          {summary.total_pending > 0 && (
            <span className="ml-2">{t('execution.pendingCount', summary.total_pending)}</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="divide-y divide-gray-50">
        {singleBrand ? (
          // Single brand: skip brand layer, show stores directly
          sortStores(sortedBrands[0].restaurants).map(store => (
            <StoreRow
              key={store.id}
              store={store}
              problems={problemsByRestaurant.get(store.id) || []}
              overview={overviewByRestaurant.get(store.id)}
              expanded={expandedStores.has(store.id)}
              onToggle={() => toggleStore(store.id)}
              playingKey={playingKey}
              onAudioToggle={onAudioToggle}
              indent={false}
              router={router}
            />
          ))
        ) : (
          // Multiple brands: brand → store → problems
          sortedBrands.map(brand => {
            const brandExpanded = expandedBrands.has(brand.brand_id);
            const allReviewed = brand.summary.reviewed_count === brand.summary.total_count;
            return (
              <Fragment key={brand.brand_id ?? 'other'}>
                {/* Brand row */}
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer active:bg-gray-50 transition-colors"
                  onClick={() => toggleBrand(brand.brand_id)}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Chevron expanded={brandExpanded} />
                    <span className="text-sm font-semibold text-gray-900">{brand.brand_name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs flex-shrink-0">
                    <span className={allReviewed ? 'text-green-600' : 'text-amber-600'}>
                      {t('execution.reviewCount', brand.summary.reviewed_count, brand.summary.total_count)}
                    </span>
                    {brand.summary.total_pending > 0 ? (
                      <span className="text-red-500 font-medium">{brand.summary.total_pending}条</span>
                    ) : (
                      <span className="text-gray-300">0条</span>
                    )}
                  </div>
                </div>

                {/* Expanded stores */}
                {brandExpanded && (
                  <div className="bg-gray-50/30">
                    {sortStores(brand.restaurants).map(store => (
                      <StoreRow
                        key={store.id}
                        store={store}
                        problems={problemsByRestaurant.get(store.id) || []}
                        overview={overviewByRestaurant.get(store.id)}
                        expanded={expandedStores.has(store.id)}
                        onToggle={() => toggleStore(store.id)}
                        playingKey={playingKey}
                        onAudioToggle={onAudioToggle}
                        indent={true}
                        router={router}
                      />
                    ))}
                  </div>
                )}
              </Fragment>
            );
          })
        )}
      </div>
    </div>
  );
}

// --- Store row (Level 2) ---
function StoreRow({
  store,
  problems,
  overview,
  expanded,
  onToggle,
  playingKey,
  onAudioToggle,
  indent,
  router,
}: {
  store: BrandRestaurant;
  problems: BriefingProblem[];
  overview: RestaurantOverview | undefined;
  expanded: boolean;
  onToggle: () => void;
  playingKey: string | null;
  onAudioToggle: (key: string, url: string) => void;
  indent: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  const { t } = useT();
  const { dot } = getStoreStatusColor(store);

  return (
    <>
      <div
        className={`flex items-center justify-between py-2.5 cursor-pointer active:bg-gray-50 transition-colors ${
          indent ? 'pl-10 pr-4' : 'px-4'
        }`}
        onClick={onToggle}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
          <span className="text-sm text-gray-700 truncate">{store.name}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400 flex-shrink-0 flex-wrap justify-end">
          <span>{t('briefing.visits', store.visit_count)}</span>
          <span>·</span>
          <span className={store.avg_sentiment != null
            ? (store.avg_sentiment >= 70 ? 'text-green-600' : store.avg_sentiment >= 50 ? 'text-yellow-600' : 'text-red-600')
            : 'text-gray-400'
          }>
            {store.avg_sentiment != null ? t('briefing.score', Math.round(store.avg_sentiment)) : '--'}
          </span>
          <span>·</span>
          <span className={store.review_done ? 'text-green-600' : 'text-red-500'}>
            {t('briefing.review')}{store.review_done ? '✓' : '✗'}
          </span>
          {problems.length > 0 && (
            <>
              <span>·</span>
              <span className="text-red-600">{t('briefing.problems', problems.length)}</span>
            </>
          )}
          <Chevron expanded={expanded} className="ml-1" />
        </div>
      </div>

      {/* Expanded: problem detail (Level 3) */}
      {expanded && (
        <div className={`pb-3 space-y-3 ${indent ? 'pl-12 pr-4' : 'pl-8 pr-4'}`}>
          {problems.length > 0 ? (
            problems.map((problem, idx) => (
              <ProblemCard
                key={`${problem.category}-${idx}`}
                problem={problem}
                playingKey={playingKey}
                onAudioToggle={onAudioToggle}
              />
            ))
          ) : (
            <div className="text-xs text-gray-400 py-1">{t('execution.noProblems')}</div>
          )}

          {/* Latest review */}
          {overview?.latest_review && (
            <div className="bg-primary-50/50 border border-primary-100 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                <span className="text-xs font-medium text-primary-700">{t('briefing.recentReview')}</span>
              </div>
              {overview.latest_review.ai_summary && (
                <p className="text-sm text-gray-700 leading-relaxed">{overview.latest_review.ai_summary}</p>
              )}
              {Array.isArray(overview.latest_review.action_items) && overview.latest_review.action_items.length > 0 && (
                <div className="mt-2">
                  <div className="text-[10px] text-gray-400 mb-1">{t('briefing.actionItems')}</div>
                  <ul className="space-y-1">
                    {overview.latest_review.action_items.map((item: unknown, i: number) => {
                      const text = typeof item === 'string' ? item
                        : item && typeof item === 'object' ? (item as Record<string, string>).what || (item as Record<string, string>).text || JSON.stringify(item)
                        : String(item);
                      return (
                        <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                          <span className="text-primary-400 mt-0.5">·</span>
                          <span>{text}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* View detail link */}
          <button
            onClick={() => router.push(`/admin/restaurant-detail?id=${store.id}`)}
            className="text-xs text-primary-600 hover:text-primary-700 transition-colors"
          >
            {t('execution.viewDetail')} ›
          </button>
        </div>
      )}
    </>
  );
}

// --- Problem Card (compact) ---
function ProblemCard({
  problem,
  playingKey,
  onAudioToggle,
}: {
  problem: BriefingProblem;
  playingKey: string | null;
  onAudioToggle: (key: string, url: string) => void;
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const severityBg = problem.severity === 'red' ? 'bg-red-50/50 border-red-100' : 'bg-amber-50/50 border-amber-100';
  const severityColor = problem.severity === 'red' ? 'bg-red-500' : 'bg-amber-400';

  return (
    <div className={`rounded-xl overflow-hidden border ${severityBg}`}>
      <div className="px-3 pt-3 pb-1.5">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`w-1.5 h-1.5 rounded-full ${severityColor} flex-shrink-0`} />
          <h3 className="text-sm font-semibold text-gray-900 leading-snug">{problem.title}</h3>
        </div>
        {problem.metric && (
          <p className="text-xs text-gray-400 ml-3.5">{problem.metric}</p>
        )}
      </div>

      {problem.evidence.length > 0 && (
        <div className="px-1.5 pb-2">
          {problem.evidence.map((ev, i) => {
            const isExpanded = expandedIdx === i;
            const hasQA = (ev.managerQuestions?.length ?? 0) > 0 || (ev.customerAnswers?.length ?? 0) > 0;
            const audioKey = `${problem.restaurantId}-${problem.category}-${i}`;
            return (
              <div key={i} className={`rounded-lg transition-colors ${isExpanded ? 'bg-white/60' : ''}`}>
                <div
                  className={`flex items-center gap-2 px-2.5 py-2 ${hasQA ? 'cursor-pointer' : ''}`}
                  onClick={() => hasQA && setExpandedIdx(isExpanded ? null : i)}
                >
                  <p className="text-sm text-gray-700 flex-1 leading-relaxed">
                    &ldquo;{ev.text}&rdquo;
                  </p>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                      {ev.tableId}
                    </span>
                    {ev.audioUrl && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onAudioToggle(audioKey, ev.audioUrl!); }}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                          playingKey === audioKey
                            ? 'bg-primary-100 text-primary-600'
                            : 'bg-gray-100 text-gray-600 hover:text-primary-600 hover:bg-primary-50'
                        }`}
                      >
                        {playingKey === audioKey ? (
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                        ) : (
                          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        )}
                      </button>
                    )}
                    {hasQA && (
                      <svg
                        className={`w-4 h-4 text-gray-300 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-2.5 pb-2.5 pt-0">
                    <div className="border-l-2 border-primary-200 pl-3 py-1.5">
                      <QAConversation
                        questions={ev.managerQuestions ?? []}
                        answers={ev.customerAnswers ?? []}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Q&A conversation renderer ---
function QAConversation({ questions, answers }: { questions: string[]; answers: string[] }) {
  const { t } = useT();
  const maxLen = Math.max(questions.length, answers.length);
  if (maxLen === 0) return null;
  return (
    <div className="space-y-1.5">
      {Array.from({ length: maxLen }).map((_, j) => (
        <Fragment key={j}>
          {questions[j] && (
            <div className="flex gap-2">
              <span className="text-[10px] text-gray-400 mt-0.5 flex-shrink-0 w-7 text-right">{t('briefing.manager')}</span>
              <p className="text-xs text-gray-500 flex-1">{questions[j]}</p>
            </div>
          )}
          {answers[j] && (
            <div className="flex gap-2">
              <span className="text-[10px] text-primary-500 mt-0.5 flex-shrink-0 w-7 text-right">{t('briefing.customer')}</span>
              <p className="text-xs text-gray-800 flex-1">{answers[j]}</p>
            </div>
          )}
        </Fragment>
      ))}
    </div>
  );
}
