// Step 1: Briefing — Combined pre-meeting overview (scrollable single page)
// Sections: Today's data → Pending actions → Agenda items
// Designed for quick scan before recording — one page, one "开始录音" button

'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  BarChart3, CheckCircle2, Circle, AlertTriangle,
  ChevronDown, MessageSquareQuote, Mic,
} from 'lucide-react';
import { getApiUrl } from '@/lib/api';
import { getAuthHeaders } from '@/contexts/AuthContext';
import type { DailySummaryData, ActionItemData, AgendaItem } from './types';
import { SEVERITY_CONFIG, CATEGORY_LABELS, ROLE_LABELS } from './types';

interface ReviewStepBriefingProps {
  summary: DailySummaryData | null;
  summaryLoading: boolean;
  pendingActions: ActionItemData[];
  pendingLoading: boolean;
  restaurantId: string | undefined;
  onCompletedCountChange: (count: number) => void;
  onStartRecording: () => void;
}

export function ReviewStepBriefing({
  summary,
  summaryLoading,
  pendingActions,
  pendingLoading,
  restaurantId,
  onCompletedCountChange,
  onStartRecording,
}: ReviewStepBriefingProps) {
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedAgendaIdx, setExpandedAgendaIdx] = useState<number | null>(null);

  useEffect(() => {
    onCompletedCountChange(completedIds.size);
  }, [completedIds.size, onCompletedCountChange]);

  const toggleComplete = useCallback(async (id: string) => {
    if (updatingId) return;
    setUpdatingId(id);
    const isCompleting = !completedIds.has(id);

    // Optimistic update — show check immediately, revert on failure
    setCompletedIds(prev => {
      const next = new Set(prev);
      if (isCompleting) next.add(id);
      else next.delete(id);
      return next;
    });

    try {
      const res = await fetch(getApiUrl(`api/action-items/${id}`), {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: isCompleting ? 'resolved' : 'pending' }),
      });
      if (!res.ok) {
        // Revert on failure
        setCompletedIds(prev => {
          const next = new Set(prev);
          if (isCompleting) next.delete(id);
          else next.add(id);
          return next;
        });
      }
    } catch {
      // Revert on network error
      setCompletedIds(prev => {
        const next = new Set(prev);
        if (isCompleting) next.delete(id);
        else next.add(id);
        return next;
      });
    } finally {
      setUpdatingId(null);
    }
  }, [completedIds, updatingId]);

  const agendaItems = summary?.agenda_items ?? [];
  const isLoading = summaryLoading || pendingLoading;

  return (
    <div className="flex flex-col min-h-[calc(100vh-160px)]">
      <div className="flex-1 space-y-5 pb-4">

        {/* ── Section 1: Data Snapshot ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-primary-600" />
            <h3 className="text-sm font-semibold text-gray-900">今日数据</h3>
          </div>

          {summaryLoading ? (
            <div className="glass-card rounded-xl p-4 animate-pulse">
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-200 rounded-lg" />)}
              </div>
            </div>
          ) : !summary ? (
            <div className="glass-card rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400">今日暂无桌访数据</p>
            </div>
          ) : (
            <div className="glass-card rounded-xl p-4">
              {/* Compact stats row */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xl font-bold text-gray-900">{summary.total_visits}</p>
                  <p className="text-xs text-gray-400">桌访数</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">
                    {summary.avg_sentiment !== null ? summary.avg_sentiment.toFixed(1) : '--'}
                  </p>
                  <p className="text-xs text-gray-400">均分</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-red-500">{summary.negative_count ?? 0}</p>
                  <p className="text-xs text-gray-400">负面反馈</p>
                </div>
              </div>
              {summary.ai_overview && (
                <p className="text-xs text-gray-500 mt-3 leading-relaxed border-t border-gray-100 pt-2">
                  {summary.ai_overview}
                </p>
              )}
            </div>
          )}
        </section>

        {/* ── Section 2: Pending Actions ── */}
        {pendingLoading ? (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <h3 className="text-sm font-semibold text-gray-900">上次待办</h3>
            </div>
            <div className="space-y-2 animate-pulse">
              {[1, 2].map(i => <div key={i} className="h-12 bg-gray-200 rounded-xl" />)}
            </div>
          </section>
        ) : pendingActions.length > 0 ? (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <h3 className="text-sm font-semibold text-gray-900">上次待办</h3>
              <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                {pendingActions.length}项
              </span>
              {completedIds.size > 0 && (
                <span className="text-xs text-green-600 ml-auto">
                  已完成 {completedIds.size}
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              {pendingActions.map(action => {
                const isCompleted = completedIds.has(action.id);
                const isUpdating = updatingId === action.id;
                return (
                  <button
                    key={action.id}
                    onClick={() => toggleComplete(action.id)}
                    disabled={isUpdating}
                    className={`w-full glass-card rounded-xl px-3 py-2.5 flex items-center gap-2.5 text-left transition-all ${
                      isCompleted ? 'opacity-50' : ''
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    )}
                    <span className={`text-sm flex-1 ${isCompleted ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                      {action.suggestion_text}
                    </span>
                    {action.assigned_role && (
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {ROLE_LABELS[action.assigned_role] ?? ''}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}
        {/* When no pending actions, skip section entirely — no noise */}

        {/* ── Section 3: Agenda (problems to discuss) ── */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900">待讨论问题</h3>
            {agendaItems.length > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                {agendaItems.length}项
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-3">
            会议中请逐条追问「为什么发生」，找到根因再定行动
          </p>

          {summaryLoading ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2].map(i => <div key={i} className="h-16 bg-gray-200 rounded-xl" />)}
            </div>
          ) : agendaItems.length === 0 ? (
            <div className="glass-card rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400">今日暂无需讨论的问题</p>
            </div>
          ) : (
            <div className="space-y-2">
              {agendaItems.map((item, idx) => {
                const config = SEVERITY_CONFIG[item.severity] || SEVERITY_CONFIG.low;
                const categoryLabel = CATEGORY_LABELS[item.category] || item.category;
                const isExpanded = expandedAgendaIdx === idx;

                return (
                  <div key={idx} className={`rounded-xl border overflow-hidden ${config.bg}`}>
                    <button
                      onClick={() => setExpandedAgendaIdx(isExpanded ? null : idx)}
                      className="w-full p-3 flex items-start gap-2 text-left"
                    >
                      <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${config.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500 font-medium">{categoryLabel}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-900">{item.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{item.evidenceCount}桌反映</p>
                      </div>
                      {item.feedbacks && item.feedbacks.length > 0 && (
                        <ChevronDown
                          className={`w-4 h-4 text-gray-400 mt-1 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      )}
                    </button>

                    {isExpanded && item.feedbacks && item.feedbacks.length > 0 && (
                      <div className="px-3 pb-3">
                        <div className="bg-white/60 rounded-lg p-2.5 space-y-1.5">
                          <p className="text-xs text-gray-500 font-medium flex items-center gap-1">
                            <MessageSquareQuote className="w-3 h-3" /> 顾客原声
                          </p>
                          {item.feedbacks.map((fb, fbIdx) => (
                            <div key={fbIdx} className="flex items-start gap-2 text-xs">
                              <span className="text-gray-400 flex-shrink-0">{fb.tableId}桌</span>
                              <span className="text-gray-700">&ldquo;{fb.text}&rdquo;</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Fixed bottom: Start Recording button */}
      <div className="sticky bottom-0 pt-2 pb-2 bg-gradient-to-t from-white via-white to-transparent -mx-4 px-4">
        <button
          onClick={onStartRecording}
          disabled={isLoading}
          className="w-full py-3.5 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
        >
          <Mic className="w-5 h-5" />
          开始复盘录音
        </button>
      </div>
    </div>
  );
}
