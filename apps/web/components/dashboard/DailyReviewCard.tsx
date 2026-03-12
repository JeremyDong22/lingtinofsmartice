// DailyReviewCard - Meeting summary + action items integrated card
// Replaces standalone ActionItemsCard on the dashboard

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { getApiUrl } from '@/lib/api';
import { getAuthHeaders } from '@/contexts/AuthContext';
import { getCacheConfig } from '@/contexts/SWRProvider';
import { useT } from '@/lib/i18n';
import type { ActionItem, ActionItemsResponse } from '@/lib/action-item-constants';
import { CATEGORY_LABELS, PRIORITY_CONFIG, STATUS_CONFIG, ROLE_LABELS } from '@/lib/action-item-constants';

interface MeetingRecord {
  id: string;
  meeting_type: string;
  status: string;
  ai_summary: string | null;
  action_items: unknown;
  key_decisions: string[] | null;
  audio_url: string | null;
  duration_seconds: number | null;
  created_at: string;
}

interface MeetingResponse {
  records: MeetingRecord[];
}

interface DailyReviewCardProps {
  restaurantId: string;
  date: string;
  negativeCount: number;
}

export function DailyReviewCard({ restaurantId, date, negativeCount }: DailyReviewCardProps) {
  const { t } = useT();
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [decisionsOpen, setDecisionsOpen] = useState(false);

  const params = new URLSearchParams({ restaurant_id: restaurantId, date }).toString();
  const { data: meetingData, isLoading: meetingLoading } = useSWR<MeetingResponse>(
    `/api/meeting/today?${params}`,
    { ...getCacheConfig('realtime') }
  );
  const { data: actionData, isLoading: actionsLoading, mutate } = useSWR<ActionItemsResponse>(
    `/api/action-items?${params}`,
    { ...getCacheConfig('statistics') }
  );

  const meetings = meetingData?.records ?? [];
  const reviewMeeting = meetings.find(m => m.meeting_type === 'daily_review') ?? meetings[0];
  const actions = actionData?.actions ?? [];
  const isLoading = meetingLoading || actionsLoading;
  const hasReview = !!reviewMeeting && reviewMeeting.status === 'processed';

  // Update action item status via PATCH with optimistic UI
  const handleUpdateStatus = async (id: string, status: string, note?: string) => {
    setUpdatingId(id);

    // Optimistic update: immediately update UI
    mutate(
      async () => {
        const res = await fetch(
          getApiUrl(`api/action-items/${id}`),
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
            body: JSON.stringify({ status, note }),
          },
        );
        if (!res.ok) throw new Error('Update failed');
        return actionData;  // Return current data, will revalidate
      },
      {
        optimisticData: actionData ? {
          ...actionData,
          actions: actionData.actions.map(item =>
            item.id === id ? { ...item, status: status as ActionItem['status'], response_note: note || item.response_note } : item
          ),
        } : undefined,
        rollbackOnError: true,
        populateCache: false,
        revalidate: true,
      }
    );

    try {
      if (status === 'resolved') {
        setResolvingId(null);
        setResolveNotes(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to update action item:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
          <div className="h-3 bg-gray-100 rounded w-full mb-2" />
          <div className="h-3 bg-gray-100 rounded w-4/5" />
        </div>
      </div>
    );
  }

  // State B: Not reviewed
  if (!hasReview) {
    if (negativeCount <= 0) return null;
    return (
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-800">{t('dashboard.notReviewed')}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {t('dashboard.notReviewedHint', negativeCount)}
            </p>
          </div>
          <button
            onClick={() => router.push('/recorder')}
            className="text-xs text-primary-600 font-medium hover:text-primary-700 transition-colors flex-shrink-0"
          >
            {t('dashboard.goReview')} →
          </button>
        </div>
      </div>
    );
  }

  // State A: Has review meeting
  const keyDecisions = reviewMeeting.key_decisions ?? [];

  return (
    <div className="glass-card rounded-2xl p-4">
      <h2 className="text-sm font-medium text-gray-700 mb-3">{t('dashboard.dailyReview')}</h2>

      {/* Meeting Summary */}
      {reviewMeeting.ai_summary && (
        <div className="mb-3">
          <div className="text-xs font-medium text-gray-500 mb-1">{t('dashboard.meetingSummary')}</div>
          <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-xl px-3 py-2">
            {reviewMeeting.ai_summary}
          </p>
        </div>
      )}

      {/* Key Decisions - collapsible */}
      {keyDecisions.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setDecisionsOpen(!decisionsOpen)}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="text-xs font-medium text-gray-500">
              {t('dashboard.keyDecisions')} ({keyDecisions.length})
            </span>
            <svg
              className={`w-3.5 h-3.5 text-gray-400 transition-transform ${decisionsOpen ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          {decisionsOpen && (
            <ul className="mt-1.5 space-y-1">
              {keyDecisions.map((decision, idx) => (
                <li key={idx} className="text-sm text-gray-700 flex items-start gap-1.5">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <span>{decision}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Action Items */}
      {actions.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-500 mb-2">
            {t('dashboard.actionItems')} ({actions.length})
          </div>
          <div className="space-y-3">
            {actions.map((item) => (
              <div
                key={item.id}
                className={`rounded-xl border p-3 transition-colors ${
                  item.status === 'resolved'
                    ? 'border-green-200 bg-green-50/50'
                    : item.status === 'acknowledged'
                      ? 'border-primary-200 bg-primary-50/30'
                      : 'border-gray-200'
                }`}
              >
                {/* Header: priority + category + role + status */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${PRIORITY_CONFIG[item.priority]?.bg} ${PRIORITY_CONFIG[item.priority]?.color}`}>
                    {PRIORITY_CONFIG[item.priority]?.label || item.priority}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                    {CATEGORY_LABELS[item.category] || item.category}
                  </span>
                  {(item.assigned_role || item.assignee) && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600">
                      {ROLE_LABELS[item.assigned_role || ''] || item.assignee || item.assigned_role}
                    </span>
                  )}
                  <span className={`ml-auto text-xs ${STATUS_CONFIG[item.status]?.color || 'text-gray-500'}`}>
                    {STATUS_CONFIG[item.status]?.label || item.status}
                  </span>
                </div>

                {/* Suggestion text */}
                <p className="text-sm text-gray-800 leading-relaxed">{item.suggestion_text}</p>

                {/* Resolved note */}
                {item.status === 'resolved' && item.resolved_note && (
                  <div className="mt-2 text-xs text-green-700 bg-green-50 rounded-lg px-2 py-1">
                    备注: {item.resolved_note}
                  </div>
                )}

                {/* Evidence toggle */}
                {item.evidence && item.evidence.length > 0 && (
                  <button
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    className="mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {expandedId === item.id ? '收起详情' : `查看原始反馈 (${item.evidence.length}条)`}
                  </button>
                )}

                {/* Evidence list */}
                {expandedId === item.id && item.evidence && (
                  <div className="mt-2 space-y-1.5">
                    {item.evidence.map((ev, idx) => (
                      <div key={idx} className="text-xs bg-gray-50 rounded-lg px-2.5 py-1.5">
                        <span className="text-gray-500">{ev.tableId}桌:</span>{' '}
                        <span className="text-gray-700">&ldquo;{ev.feedback}&rdquo;</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action buttons - pending */}
                {item.status === 'pending' && (
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => handleUpdateStatus(item.id, 'acknowledged')}
                      disabled={updatingId === item.id}
                      className="px-3 py-1 text-xs rounded-full bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors disabled:opacity-50"
                    >
                      知悉
                    </button>
                    <button
                      onClick={() => setResolvingId(resolvingId === item.id ? null : item.id)}
                      disabled={updatingId === item.id}
                      className="px-3 py-1 text-xs rounded-full bg-green-50 text-green-600 hover:bg-green-100 transition-colors disabled:opacity-50"
                    >
                      已解决
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(item.id, 'dismissed')}
                      disabled={updatingId === item.id}
                      className="px-3 py-1 text-xs rounded-full bg-gray-50 text-gray-400 hover:bg-gray-100 transition-colors disabled:opacity-50 ml-auto"
                    >
                      忽略
                    </button>
                  </div>
                )}

                {/* Acknowledged: allow resolving */}
                {item.status === 'acknowledged' && (
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => setResolvingId(resolvingId === item.id ? null : item.id)}
                      disabled={updatingId === item.id}
                      className="px-3 py-1 text-xs rounded-full bg-green-50 text-green-600 hover:bg-green-100 transition-colors disabled:opacity-50"
                    >
                      标记已解决
                    </button>
                  </div>
                )}

                {/* Resolve note input */}
                {resolvingId === item.id && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="text"
                      value={resolveNotes[item.id] ?? ''}
                      onChange={(e) => setResolveNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder="备注（可选）"
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-400"
                    />
                    <button
                      onClick={() => handleUpdateStatus(item.id, 'resolved', resolveNotes[item.id] || undefined)}
                      disabled={updatingId === item.id}
                      className="px-3 py-1.5 text-xs rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-50"
                    >
                      确认
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No action items but has review */}
      {actions.length === 0 && (
        <div className="text-center py-3 text-sm text-gray-400">
          暂无行动建议
        </div>
      )}
    </div>
  );
}
