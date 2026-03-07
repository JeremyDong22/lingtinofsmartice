// FeedbackLoopCards - 2x2 metric cards for feedback loop (visit/review/action/execution)

'use client';

import { useT } from '@/lib/i18n';

export interface FeedbackLoopRestaurant {
  restaurant_id: string;
  restaurant_name: string;
  brand_id: number | null;
  visit: { visit_count: number; open_count: number; coverage_rate: number; negative_count: number; health: string; trend?: string };
  review: { review_days: number; total_days: number; completion_rate: number; avg_duration_seconds: number | null; health: string; trend?: string };
  action: { total_items: number; high_priority_count: number; health: string };
  execution: { total_items: number; resolved_count: number; resolution_rate: number; health: string; trend?: string };
}

interface FeedbackLoopCardsProps {
  data: FeedbackLoopRestaurant;
  onDrillDown?: (type: 'action' | 'execution') => void;
}

const healthDot: Record<string, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-400',
  red: 'bg-red-500',
};

const healthText: Record<string, string> = {
  green: 'text-green-600',
  yellow: 'text-yellow-600',
  red: 'text-red-600',
};

function TrendArrow({ trend }: { trend?: string }) {
  const { t } = useT();
  if (!trend || trend === 'flat') return null;
  const isUp = trend === 'up';
  return (
    <span className={`text-xs font-medium ${isUp ? 'text-green-500' : 'text-red-500'}`}>
      {t(isUp ? 'feedbackLoop.trendUp' : 'feedbackLoop.trendDown')}
    </span>
  );
}

export function FeedbackLoopCards({ data, onDrillDown }: FeedbackLoopCardsProps) {
  const { t } = useT();

  const cards = [
    {
      key: 'visit' as const,
      icon: '📋',
      label: t('feedbackLoop.visit'),
      primary: t('feedbackLoop.visitCoverage', data.visit.coverage_rate),
      secondary: `${t('feedbackLoop.visitCount', data.visit.visit_count)} · ${t('feedbackLoop.negativeCount', data.visit.negative_count)}`,
      health: data.visit.health,
      trend: data.visit.trend,
      clickable: false,
    },
    {
      key: 'review' as const,
      icon: '🔄',
      label: t('feedbackLoop.review'),
      primary: t('feedbackLoop.reviewCompletion', data.review.completion_rate),
      secondary: `${t('feedbackLoop.reviewDays', data.review.review_days, data.review.total_days)}${data.review.avg_duration_seconds ? ` · ${t('feedbackLoop.avgDuration', Math.round(data.review.avg_duration_seconds / 60))}` : ''}`,
      health: data.review.health,
      trend: data.review.trend,
      clickable: false,
    },
    {
      key: 'action' as const,
      icon: '⚡',
      label: t('feedbackLoop.action'),
      primary: t('feedbackLoop.actionItems', data.action.total_items),
      secondary: t('feedbackLoop.highPriority', data.action.high_priority_count),
      health: data.action.health,
      trend: undefined,
      clickable: true,
    },
    {
      key: 'execution' as const,
      icon: '✅',
      label: t('feedbackLoop.execution'),
      primary: t('feedbackLoop.resolutionRate', data.execution.resolution_rate),
      secondary: t('feedbackLoop.resolved', data.execution.resolved_count, data.execution.total_items),
      health: data.execution.health,
      trend: data.execution.trend,
      clickable: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 mb-3">
      {cards.map((card) => (
        <div
          key={card.key}
          className={`rounded-xl border border-gray-100 bg-white/60 p-2.5 ${
            card.clickable ? 'cursor-pointer active:bg-gray-50 transition-colors' : ''
          }`}
          onClick={card.clickable ? () => onDrillDown?.(card.key as 'action' | 'execution') : undefined}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs">{card.icon}</span>
            <span className="text-[11px] text-gray-500 font-medium">{card.label}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${healthDot[card.health] || 'bg-gray-300'}`} />
            <TrendArrow trend={card.trend} />
          </div>
          <div className={`text-sm font-semibold ${healthText[card.health] || 'text-gray-600'}`}>
            {card.primary}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">
            {card.secondary}
          </div>
          {card.clickable && (
            <div className="text-[10px] text-primary-500 mt-1">
              {t('execution.viewDetail')} ›
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
