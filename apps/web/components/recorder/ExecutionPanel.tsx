// ExecutionPanel - Daily execution tracking for manager recorder page
// Shows review status + pending action items count

'use client';

import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { Clock, CheckCircle } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { getChinaYesterday } from '@/lib/date-utils';

interface ExecutionSummary {
  review_done: boolean;
  pending_actions: number;
}

interface ExecutionPanelProps {
  restaurantId: string | undefined;
  onGoReview?: () => void;
}

export function ExecutionPanel({ restaurantId, onGoReview }: ExecutionPanelProps) {
  const { t } = useT();
  const router = useRouter();
  const yesterday = getChinaYesterday();

  const { data } = useSWR<ExecutionSummary>(
    restaurantId ? `/api/dashboard/execution-summary?restaurant_id=${restaurantId}&date=${yesterday}` : null,
  );

  if (!data) return null;

  const { review_done, pending_actions } = data;
  const allDone = review_done && pending_actions === 0;

  // Hide panel when everything is done
  if (allDone) return null;

  return (
    <div className="mb-4">
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-gray-200">
          {/* Review status */}
          <button
            onClick={() => !review_done && onGoReview?.()}
            disabled={review_done}
            className={`flex items-center gap-2.5 px-4 py-3 text-left transition-colors ${
              review_done
                ? 'cursor-default'
                : 'active:bg-amber-50'
            }`}
          >
            {review_done ? (
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
            ) : (
              <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <div className="text-xs text-gray-500">{t('execution.yesterdayReview')}</div>
              <div className={`text-sm font-medium ${
                review_done ? 'text-green-600' : 'text-amber-600'
              }`}>
                {review_done ? t('execution.done') : t('execution.goReview')}
              </div>
            </div>
          </button>

          {/* Pending actions */}
          <button
            onClick={() => pending_actions > 0 && router.push('/dashboard')}
            disabled={pending_actions === 0}
            className={`flex items-center gap-2.5 px-4 py-3 text-left transition-colors ${
              pending_actions > 0
                ? 'active:bg-red-50'
                : 'cursor-default'
            }`}
          >
            {pending_actions > 0 ? (
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                {pending_actions > 99 ? '99+' : pending_actions}
              </span>
            ) : (
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <div className="text-xs text-gray-500">{t('execution.pending')}</div>
              <div className={`text-sm font-medium ${
                pending_actions > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {pending_actions > 0
                  ? `${pending_actions}${t('execution.pendingActions')}`
                  : t('execution.allDone')
                }
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
