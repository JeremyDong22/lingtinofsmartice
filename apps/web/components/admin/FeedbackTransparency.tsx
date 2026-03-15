// FeedbackTransparency - 管理层反馈透明视图
// 跨门店问题概览 + 单店详情展开 + 回复功能

'use client';

import { useState, useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { getCacheConfig } from '@/contexts/SWRProvider';
import { replyToIssue } from '@/lib/feedback-issues-api';
import type { FeedbackIssue, ManagementSummaryResponse, ManagementSummaryRestaurant } from '@/lib/feedback-issues-api';
import { DailyCountsSparkline, getWeekCount, daysSince } from '@/components/shared/FeedbackWidgets';

// Classification icons
const CLS_ICONS: Record<string, string> = {
  unclassified: '⚪',
  todo: '📌',
  resolved: '✅',
  dismissed: '💤',
};

// Summary row for one restaurant
function RestaurantSummaryRow({
  restaurant,
  isExpanded,
  onToggle,
}: {
  restaurant: ManagementSummaryRestaurant;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { issues_breakdown: b, todo_overdue_count } = restaurant;
  const hasWarning = todo_overdue_count > 0 || (b.unclassified > 0 && b.resolved === 0 && b.todo === 0);

  return (
    <div
      className={`px-4 py-3 cursor-pointer active:bg-gray-50 transition-colors ${
        hasWarning ? 'border-l-2 border-red-300' : ''
      }`}
      onClick={onToggle}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800 truncate">
              {restaurant.restaurant_name}
            </span>
            <span className="text-[10px] text-gray-400">
              问题 {restaurant.issues_total}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {b.resolved > 0 && (
              <span className="text-[10px] text-green-600">✅{b.resolved}</span>
            )}
            {b.todo > 0 && (
              <span className={`text-[10px] ${todo_overdue_count > 0 ? 'text-red-500 font-medium' : 'text-amber-600'}`}>
                📌{b.todo}
                {todo_overdue_count > 0 && ` (⚠️${todo_overdue_count}超期)`}
              </span>
            )}
            {b.dismissed > 0 && (
              <span className="text-[10px] text-gray-400">💤{b.dismissed}</span>
            )}
            {b.unclassified > 0 && (
              <span className="text-[10px] text-gray-500">⚪{b.unclassified}</span>
            )}
            {b.resolved === 0 && b.todo === 0 && b.unclassified > 0 && (
              <span className="text-[10px] text-red-500 font-medium">⚠️ 未操作</span>
            )}
          </div>
        </div>
        <span className={`text-gray-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
      </div>
    </div>
  );
}

// Detail view for one restaurant's issues
function RestaurantDetail({
  restaurantId,
  userName,
}: {
  restaurantId: string;
  userName: string;
}) {
  const swrKey = `/api/feedback-issues?restaurant_id=${restaurantId}`;
  const { data } = useSWR<{ issues: FeedbackIssue[] }>(
    swrKey,
    { ...getCacheConfig('statistics') },
  );
  const { mutate } = useSWRConfig();
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleReply = useCallback(async (issueId: string) => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      await replyToIssue(issueId, replyText.trim(), userName);
      await mutate(swrKey);
      // Also refresh management summary
      await mutate((key: string) => typeof key === 'string' && key.includes('management-summary'), undefined, { revalidate: true });
      setReplyId(null);
      setReplyText('');
    } catch (e) {
      console.error('Failed to reply:', e);
    } finally {
      setSubmitting(false);
    }
  }, [replyText, userName, swrKey, mutate]);

  const issues = data?.issues || [];
  if (!issues.length) {
    return <div className="px-4 py-3 text-xs text-gray-400">暂无问题数据</div>;
  }

  // Sort by classification priority
  const sorted = [...issues].sort((a, b) => {
    const order: Record<string, number> = { todo: 0, unclassified: 1, resolved: 2, dismissed: 3 };
    return (order[a.classification] ?? 1) - (order[b.classification] ?? 1);
  });

  return (
    <div className="bg-gray-50/50 border-t border-gray-100">
      {sorted.map((issue) => {
        const cls = CLS_ICONS[issue.classification] || '⚪';
        const todoDays = issue.classification === 'todo'
          ? daysSince(issue.manager_action_at) ?? daysSince(issue.chef_action_at)
          : null;
        const weekCount = getWeekCount(issue.daily_counts || []);

        return (
          <div key={issue.id} className="px-4 py-2.5 border-b border-gray-100/80 last:border-b-0">
            {/* Issue header */}
            <div className="flex items-start gap-2">
              <span className="text-xs mt-0.5">{cls}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-800 font-medium">{issue.topic}</span>
                  {todoDays !== null && todoDays > 3 && (
                    <span className={`text-[10px] font-medium ${todoDays >= 7 ? 'text-red-500' : 'text-amber-500'}`}>
                      待办 {todoDays}天
                    </span>
                  )}
                </div>

                {/* Role actions */}
                <div className="mt-1 space-y-0.5">
                  {issue.manager_classification && (
                    <div className="text-[10px] text-gray-500">
                      店长: {CLS_ICONS[issue.manager_classification]}{' '}
                      {issue.manager_action_note && `"${issue.manager_action_note}"`}
                      {issue.manager_action_by && ` — ${issue.manager_action_by}`}
                      {issue.manager_action_at && ` ${new Date(issue.manager_action_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}`}
                    </div>
                  )}
                  {issue.chef_classification && (
                    <div className="text-[10px] text-gray-500">
                      厨师长: {CLS_ICONS[issue.chef_classification]}{' '}
                      {issue.chef_action_note && `"${issue.chef_action_note}"`}
                      {issue.chef_action_by && ` — ${issue.chef_action_by}`}
                      {issue.chef_action_at && ` ${new Date(issue.chef_action_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}`}
                    </div>
                  )}
                  {!issue.manager_classification && !issue.chef_classification && (
                    <div className="text-[10px] text-gray-400">门店未操作</div>
                  )}
                </div>

                {/* Existing management reply */}
                {issue.management_reply && (
                  <div className="mt-1 text-[10px] text-blue-600">
                    💬 {issue.management_reply}
                    <span className="text-blue-400">
                      {' — '}{issue.management_reply_by}{' '}
                      {issue.management_reply_at && new Date(issue.management_reply_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                    </span>
                  </div>
                )}
              </div>

              {/* Right side: trend */}
              <div className="text-right flex-shrink-0">
                <div className="text-[10px] text-gray-400">本周{weekCount}次</div>
                <DailyCountsSparkline dailyCounts={issue.daily_counts || []} />
              </div>
            </div>

            {/* Reply button */}
            {replyId !== issue.id && (
              <button
                onClick={() => { setReplyId(issue.id); setReplyText(issue.management_reply || ''); }}
                className="text-[10px] text-blue-500 mt-1 ml-5 active:text-blue-700"
              >
                {issue.management_reply ? '修改回复' : '回复意见'}
              </button>
            )}

            {/* Reply input */}
            {replyId === issue.id && (
              <div className="mt-2 ml-5">
                <textarea
                  className="w-full text-xs border border-blue-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-300 resize-none"
                  rows={2}
                  placeholder="回复意见或指示..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2 mt-1.5">
                  <button
                    onClick={() => handleReply(issue.id)}
                    disabled={submitting || !replyText.trim()}
                    className="text-[10px] px-3 py-1 rounded-full bg-blue-500 text-white disabled:opacity-50"
                  >
                    {submitting ? '发送中...' : '发送'}
                  </button>
                  <button
                    onClick={() => { setReplyId(null); setReplyText(''); }}
                    className="text-[10px] px-3 py-1 rounded-full bg-gray-100 text-gray-500"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface FeedbackTransparencyProps {
  managedIdsParam: string;
  userName: string;
}

export function FeedbackTransparency({ managedIdsParam, userName }: FeedbackTransparencyProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const managedIds = managedIdsParam
    ? managedIdsParam.replace('&managed_ids=', '').split(',').filter(Boolean)
    : [];
  const queryParam = managedIds.length > 0 ? `?managed_ids=${managedIds.join(',')}` : '';

  const { data, isLoading } = useSWR<ManagementSummaryResponse>(
    `/api/feedback-issues/management-summary${queryParam}`,
    { ...getCacheConfig('statistics') },
  );

  const restaurants = data?.restaurants || [];

  if (isLoading && !data) {
    return (
      <div className="glass-card rounded-2xl p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
        <div className="h-3 bg-gray-100 rounded w-full mb-2" />
        <div className="h-3 bg-gray-100 rounded w-4/5" />
      </div>
    );
  }

  if (!restaurants.length) return null;

  // Sort: restaurants with warnings first, then by issues_total desc
  const sorted = [...restaurants].sort((a, b) => {
    const aWarn = a.todo_overdue_count > 0 || (a.issues_breakdown.unclassified > 0 && a.issues_breakdown.resolved === 0) ? 1 : 0;
    const bWarn = b.todo_overdue_count > 0 || (b.issues_breakdown.unclassified > 0 && b.issues_breakdown.resolved === 0) ? 1 : 0;
    if (aWarn !== bWarn) return bWarn - aWarn;
    return b.issues_total - a.issues_total;
  });

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-medium text-gray-700">反馈透明度</h2>
        <p className="text-[10px] text-gray-400 mt-0.5">
          各门店反馈聚合问题 · 门店操作追踪 · 可回复指示
        </p>
      </div>

      <div className="divide-y divide-gray-50">
        {sorted.map((restaurant) => (
          <div key={restaurant.restaurant_id}>
            <RestaurantSummaryRow
              restaurant={restaurant}
              isExpanded={expandedId === restaurant.restaurant_id}
              onToggle={() => setExpandedId(
                expandedId === restaurant.restaurant_id ? null : restaurant.restaurant_id,
              )}
            />
            {expandedId === restaurant.restaurant_id && (
              <RestaurantDetail
                restaurantId={restaurant.restaurant_id}
                userName={userName}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
