// IssuesCard - 店长问题追踪卡片
// 展示聚合后的反馈问题，支持分类操作（已处理/待办/忽略）

'use client';

import { useState, useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { ChevronDown, useAudioPlayback, AudioButton, DailyCountsSparkline, getWeekCount, daysSince } from '@/components/shared/FeedbackWidgets';
import { classifyIssue, markReplyRead } from '@/lib/feedback-issues-api';
import type { FeedbackIssue } from '@/lib/feedback-issues-api';

// Category labels
const CATEGORY_LABELS: Record<string, string> = {
  dish_quality: '菜品质量',
  service_speed: '上菜速度',
  environment: '环境',
  staff_attitude: '服务态度',
  other: '其他',
};

// Classification icons and colors
const CLS_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string; border: string }> = {
  unclassified: { icon: '⚪', label: '新发现', color: 'text-gray-600', bg: '', border: '' },
  todo: { icon: '📌', label: '待办', color: 'text-amber-700', bg: 'bg-amber-50/50', border: 'border-amber-100' },
  resolved: { icon: '✅', label: '已处理', color: 'text-green-700', bg: 'bg-green-50/50', border: 'border-green-100' },
  dismissed: { icon: '💤', label: '已忽略', color: 'text-gray-400', bg: 'bg-gray-50/50', border: 'border-gray-100' },
};

interface IssuesCardProps {
  issues: FeedbackIssue[];
  loading: boolean;
  role: 'manager' | 'head_chef';
  userName?: string;
  swrKey: string; // for mutate after action
}

export function IssuesCard({ issues, loading, role, userName, swrKey }: IssuesCardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'resolved' | 'todo' | 'dismissed' | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { playingKey, handleAudioToggle } = useAudioPlayback();
  const { mutate } = useSWRConfig();

  const handleClassify = useCallback(async (
    issueId: string,
    classification: 'resolved' | 'todo' | 'dismissed',
    note?: string,
  ) => {
    setSubmitting(true);
    try {
      await classifyIssue(issueId, role, classification, note, userName);
      await mutate(swrKey);
      setActionId(null);
      setActionType(null);
      setActionNote('');
    } catch (e) {
      console.error('Failed to classify issue:', e);
    } finally {
      setSubmitting(false);
    }
  }, [role, userName, swrKey, mutate]);

  const handleMarkRead = useCallback(async (issueId: string) => {
    try {
      await markReplyRead(issueId, role === 'head_chef' ? 'head_chef' : 'manager');
      await mutate(swrKey);
    } catch (e) {
      console.error('Failed to mark reply read:', e);
    }
  }, [role, swrKey, mutate]);

  if (loading && !issues.length) {
    return (
      <div className="glass-card rounded-2xl p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
        <div className="h-3 bg-gray-100 rounded w-full mb-2" />
        <div className="h-3 bg-gray-100 rounded w-4/5" />
      </div>
    );
  }

  if (!issues.length) return null;

  // Sort: unclassified first, then todo (overdue first), then resolved, then dismissed
  const sorted = [...issues].sort((a, b) => {
    const order: Record<string, number> = { unclassified: 0, todo: 1, resolved: 2, dismissed: 3 };
    const oa = order[a.classification] ?? 0;
    const ob = order[b.classification] ?? 0;
    if (oa !== ob) return oa - ob;
    // Within same classification, sort by last_seen_at desc
    return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime();
  });

  const roleField = role === 'manager' ? 'manager' : 'chef';
  const replyReadField = role === 'manager'
    ? 'management_reply_read_by_manager'
    : 'management_reply_read_by_chef';

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-medium text-gray-700">问题追踪</h2>
        <p className="text-[10px] text-gray-400 mt-0.5">
          同类反馈自动聚合，持续跟踪改善趋势
        </p>
      </div>

      <div className="divide-y divide-gray-50">
        {sorted.map((issue) => {
          const cls = CLS_CONFIG[issue.classification] || CLS_CONFIG.unclassified;
          const weekCount = getWeekCount(issue.daily_counts);
          const isExpanded = expandedId === issue.id;
          const isActionOpen = actionId === issue.id;
          const todoDays = issue.classification === 'todo'
            ? daysSince(issue[`${roleField}_action_at`] as string)
            : null;
          const hasUnreadReply = issue.management_reply && !issue[replyReadField];

          // Other role's action info
          const otherRole = role === 'manager' ? 'chef' : 'manager';
          const otherAction = issue[`${otherRole}_action_note`] as string | null;
          const otherActionBy = issue[`${otherRole}_action_by`] as string | null;
          const otherCls = issue[`${otherRole}_classification`] as string | null;

          return (
            <div key={issue.id} className={`${cls.bg} transition-colors`}>
              {/* Main row */}
              <div
                className="flex items-start gap-2.5 px-4 py-3 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : issue.id)}
              >
                <span className="text-sm mt-0.5 flex-shrink-0">{cls.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-800 font-medium truncate">
                      {issue.topic}
                    </span>
                    {hasUnreadReply && (
                      <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-400">
                      {CATEGORY_LABELS[issue.category] || issue.category}
                    </span>
                    <span className="text-[10px] text-gray-300">·</span>
                    <span className={`text-[10px] ${cls.color}`}>{cls.label}</span>
                    {todoDays !== null && todoDays > 0 && (
                      <>
                        <span className="text-[10px] text-gray-300">·</span>
                        <span className={`text-[10px] font-medium ${
                          todoDays >= 7 ? 'text-red-500' : todoDays >= 3 ? 'text-amber-500' : 'text-gray-500'
                        }`}>
                          {todoDays}天
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-xs text-gray-500">本周 {weekCount} 次</div>
                    <DailyCountsSparkline dailyCounts={issue.daily_counts} />
                  </div>
                  <ChevronDown expanded={isExpanded} className="text-gray-300" />
                </div>
              </div>

              {/* Other role's action */}
              {otherCls && otherAction && (
                <div className="px-4 pb-2 -mt-1">
                  <div className="text-[10px] text-gray-400">
                    {CLS_CONFIG[otherCls]?.icon} {otherActionBy || (otherRole === 'chef' ? '厨师长' : '店长')}: {otherAction}
                  </div>
                </div>
              )}

              {/* Resolved/dismissed note */}
              {(issue.classification === 'resolved' || issue.classification === 'dismissed') && (
                <div className="px-4 pb-2 -mt-1">
                  {issue[`${roleField}_action_note`] && (
                    <div className={`text-xs ${cls.color}`}>
                      &ldquo;{issue[`${roleField}_action_note`]}&rdquo;
                      {issue[`${roleField}_action_by`] && (
                        <span className="text-gray-400">
                          {' — '}{issue[`${roleField}_action_by`]}{' '}
                          {issue[`${roleField}_action_at`] ? new Date(issue[`${roleField}_action_at`] as string).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) : ''}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Management reply */}
              {issue.management_reply && (
                <div
                  className="mx-4 mb-2 p-2 rounded-lg bg-blue-50/70 border border-blue-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasUnreadReply) handleMarkRead(issue.id);
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] text-blue-600 font-medium">💬 管理层回复</span>
                    {hasUnreadReply && (
                      <span className="text-[10px] text-red-500 font-medium">🔴 新</span>
                    )}
                  </div>
                  <p className="text-xs text-blue-800">{issue.management_reply}</p>
                  {issue.management_reply_by && (
                    <p className="text-[10px] text-blue-400 mt-1">
                      — {issue.management_reply_by}{' '}
                      {issue.management_reply_at ? new Date(issue.management_reply_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) : ''}
                    </p>
                  )}
                </div>
              )}

              {/* Action buttons (for unclassified/todo) */}
              {(issue.classification === 'unclassified' || issue.classification === 'todo') && !isActionOpen && (
                <div className="flex gap-2 px-4 pb-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); setActionId(issue.id); setActionType('resolved'); }}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 active:bg-green-100"
                  >
                    已处理
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleClassify(issue.id, 'todo'); }}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 active:bg-amber-100"
                  >
                    待办
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setActionId(issue.id); setActionType('dismissed'); }}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-gray-50 text-gray-500 border border-gray-200 active:bg-gray-100"
                  >
                    忽略
                  </button>
                </div>
              )}

              {/* Action note input */}
              {isActionOpen && (
                <div className="px-4 pb-3" onClick={(e) => e.stopPropagation()}>
                  <textarea
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-300 resize-none"
                    rows={2}
                    placeholder={actionType === 'resolved' ? '简述处理措施...' : '原因（可选）...'}
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleClassify(issue.id, actionType!, actionNote || undefined)}
                      disabled={submitting || (actionType === 'resolved' && !actionNote.trim())}
                      className="text-[11px] px-3 py-1.5 rounded-full bg-blue-500 text-white disabled:opacity-50"
                    >
                      {submitting ? '提交中...' : '确认'}
                    </button>
                    <button
                      onClick={() => { setActionId(null); setActionType(null); setActionNote(''); }}
                      className="text-[11px] px-3 py-1.5 rounded-full bg-gray-100 text-gray-600"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}

              {/* Expanded evidence */}
              {isExpanded && issue.evidence?.length > 0 && (
                <div className="px-4 pb-3 space-y-2">
                  <div className="text-[10px] text-gray-400 font-medium">
                    近期证据（{Math.min(issue.evidence.length, 5)}/{issue.evidence.length}）
                  </div>
                  {(issue.evidence as Array<{
                    visit_record_id: string;
                    feedback_text: string;
                    table_id: string | null;
                    date: string;
                    audio_url: string | null;
                  }>).slice(-5).reverse().map((ev, i) => (
                    <div key={i} className="bg-white rounded-xl p-2.5 border border-gray-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-gray-400">
                          {ev.table_id || '未知桌号'} · {ev.date}
                        </span>
                        {ev.audio_url && (
                          <AudioButton
                            audioKey={`ev-${issue.id}-${i}`}
                            audioUrl={ev.audio_url}
                            playingKey={playingKey}
                            onToggle={handleAudioToggle}
                          />
                        )}
                      </div>
                      <p className="text-xs text-gray-700">&ldquo;{ev.feedback_text}&rdquo;</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
