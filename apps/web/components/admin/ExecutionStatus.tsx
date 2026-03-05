// ExecutionStatus - Multi-restaurant execution tracking for admin briefing page
// Shows review completion + pending actions per store, sorted by urgency

'use client';

import { useT } from '@/lib/i18n';

interface RestaurantExecution {
  id: string;
  name: string;
  review_done: boolean;
  pending_actions: number;
}

interface ExecutionOverview {
  restaurants: RestaurantExecution[];
  summary: {
    reviewed_count: number;
    total_count: number;
    total_pending: number;
  };
}

interface ExecutionStatusProps {
  data: ExecutionOverview | undefined;
}

function getStatusColor(r: RestaurantExecution): { dot: string; order: number } {
  if (!r.review_done && r.pending_actions > 0) return { dot: 'bg-red-500', order: 0 };
  if (!r.review_done) return { dot: 'bg-yellow-400', order: 1 };
  return { dot: 'bg-green-500', order: 2 };
}

export function ExecutionStatus({ data }: ExecutionStatusProps) {
  const { t } = useT();

  if (!data || data.restaurants.length === 0) return null;

  const { restaurants, summary } = data;

  // Sort: red → yellow → green, then by pending_actions desc
  const sorted = [...restaurants].sort((a, b) => {
    const aStatus = getStatusColor(a);
    const bStatus = getStatusColor(b);
    if (aStatus.order !== bStatus.order) return aStatus.order - bStatus.order;
    return b.pending_actions - a.pending_actions;
  });

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

      {/* Store list */}
      <div className="divide-y divide-gray-50">
        {sorted.map(r => {
          const { dot } = getStatusColor(r);
          return (
            <div key={r.id} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                <span className="text-sm text-gray-700 truncate">{r.name}</span>
              </div>
              <div className="flex items-center gap-4 text-xs flex-shrink-0">
                <span className={r.review_done ? 'text-green-600' : 'text-gray-400'}>
                  {r.review_done ? '✓' : '✗'} {t(r.review_done ? 'execution.done' : 'execution.notDone')}
                </span>
                {r.pending_actions > 0 ? (
                  <span className="text-red-500 font-medium">{r.pending_actions}条</span>
                ) : (
                  <span className="text-gray-300">0条</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
