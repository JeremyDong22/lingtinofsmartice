// ActionItemsCard - AI-generated improvement suggestions card for dashboard
// v2.0 - Removed manual generate; action items now auto-generated from review meetings

'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { getApiUrl } from '@/lib/api';
import { getAuthHeaders } from '@/contexts/AuthContext';
import type { ActionItem, ActionItemsResponse } from '@/lib/action-item-constants';
import { CATEGORY_LABELS, PRIORITY_CONFIG, STATUS_CONFIG, ROLE_LABELS } from '@/lib/action-item-constants';

interface ActionItemsCardProps {
  restaurantId: string;
  date: string;
}

export function ActionItemsCard({ restaurantId, date }: ActionItemsCardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const params = new URLSearchParams({ restaurant_id: restaurantId, date }).toString();
  const { data, isLoading, mutate } = useSWR<ActionItemsResponse>(
    `/api/action-items?${params}`,
  );

  const actions = data?.actions ?? [];

  // Update action item status via PATCH
  const handleUpdateStatus = async (id: string, status: string, note?: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch(
        getApiUrl(`api/action-items/${id}`),
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ status, response_note: note }),
        },
      );
      if (!res.ok) throw new Error('Update failed');
      await mutate();
      if (status === 'resolved') {
        setResolvingId(null);
        setResolveNote('');
      }
    } catch (err) {
      console.error('Failed to update action item:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-gray-700">AI 行动建议</h2>
      </div>

      {/* Loading state */}
      {isLoading && (
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

      {/* Empty state */}
      {!isLoading && actions.length === 0 && (
        <div className="glass-card rounded-xl p-6 text-center">
          <div className="flex justify-center mb-2">
            <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">暂无行动建议</h3>
          <p className="text-sm text-gray-500">复盘会后自动生成</p>
        </div>
      )}

      {/* Action items list */}
      {actions.length > 0 && (
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
                      <span className="text-gray-700">"{ev.feedback}"</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons */}
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

              {/* Acknowledged: still allow resolving */}
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
                    value={resolveNote}
                    onChange={(e) => setResolveNote(e.target.value)}
                    placeholder="备注（可选）"
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-400"
                  />
                  <button
                    onClick={() => handleUpdateStatus(item.id, 'resolved', resolveNote || undefined)}
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
      )}
    </div>
  );
}
