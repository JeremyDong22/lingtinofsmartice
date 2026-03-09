// Admin Activity Page - User activity tracking dashboard
// v1.2 - Aligned color palette with admin design system (gray + primary)

'use client';

import { useState, useMemo } from 'react';
import { ArrowLeft, Search, Clock, Activity } from 'lucide-react';
import useSWR from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { UserMenu } from '@/components/layout/UserMenu';

// --- Types ---
interface UserBreakdown {
  [resourceType: string]: number;
}

interface UserOverviewItem {
  user_id: string;
  username: string;
  employee_name: string;
  role_code: string;
  restaurant_id: string;
  last_active: string;
  total_actions: number;
  breakdown: UserBreakdown;
}

interface OverviewResponse {
  days: number;
  total_users: number;
  active_users: number;
  inactive_users: number;
  users: UserOverviewItem[];
}

interface TimelineItem {
  id: string;
  action_type: string;
  method: string;
  path: string;
  resource_type: string;
  created_at: string;
}

interface TimelineResponse {
  items: TimelineItem[];
  total: number;
  page: number;
  pageSize: number;
}

// --- Resource type display config ---
const RESOURCE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  auth: { label: '认证', icon: '🔑', color: 'bg-gray-100 text-gray-600' },
  dashboard: { label: '看板', icon: '📊', color: 'bg-gray-100 text-gray-600' },
  audio: { label: '录音', icon: '🎙️', color: 'bg-gray-100 text-gray-600' },
  'action-items': { label: '行动项', icon: '✅', color: 'bg-gray-100 text-gray-600' },
  meeting: { label: '会议', icon: '📋', color: 'bg-gray-100 text-gray-600' },
  chat: { label: '对话', icon: '💬', color: 'bg-gray-100 text-gray-600' },
  feedback: { label: '反馈', icon: '📝', color: 'bg-gray-100 text-gray-600' },
  staff: { label: '员工', icon: '👤', color: 'bg-gray-100 text-gray-600' },
  'daily-summary': { label: '日报', icon: '📰', color: 'bg-gray-100 text-gray-600' },
  'question-templates': { label: '问题模板', icon: '❓', color: 'bg-gray-100 text-gray-600' },
  region: { label: '区域', icon: '🏢', color: 'bg-gray-100 text-gray-600' },
  hotword: { label: '热词', icon: '🔤', color: 'bg-gray-100 text-gray-600' },
  activity: { label: '活动', icon: '📈', color: 'bg-gray-100 text-gray-600' },
  other: { label: '其他', icon: '⚙️', color: 'bg-gray-100 text-gray-600' },
};

// Action type display
function getActionLabel(item: TimelineItem): string {
  if (item.action_type === 'login') return '登录系统';
  if (item.action_type === 'logout') return '退出系统';

  const resource = RESOURCE_CONFIG[item.resource_type] || RESOURCE_CONFIG.other;
  const verb = item.method === 'GET' ? '查看' : item.method === 'POST' ? '提交' : item.method === 'PATCH' ? '更新' : item.method === 'DELETE' ? '删除' : '操作';

  if (item.path?.includes('/upload')) return '上传录音';
  if (item.path?.includes('/chat/message')) return 'AI 对话';

  return `${verb}${resource.label}`;
}

// Role code → Chinese
const ROLE_MAP: Record<string, string> = {
  administrator: '管理层',
  manager: '店长',
  head_chef: '厨师长',
  chef: '厨师',
};

// Relative time
function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '昨天';
  return `${days} 天前`;
}

// Avatar color from name
function avatarColor(name: string): string {
  const colors = [
    'bg-indigo-500', 'bg-amber-500', 'bg-emerald-500', 'bg-purple-500',
    'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-teal-500',
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
}

// Group timeline items by date
function groupByDate(items: TimelineItem[]): { date: string; label: string; items: TimelineItem[] }[] {
  const groups = new Map<string, TimelineItem[]>();

  for (const item of items) {
    const d = new Date(item.created_at);
    const key = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });

  return Array.from(groups.entries()).map(([date, items]) => ({
    date,
    label: date === today ? '今天' : date === yesterday ? '昨天' : date,
    items,
  }));
}

export default function ActivityPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [days, setDays] = useState(7);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserOverviewItem | null>(null);
  const [timelinePage, setTimelinePage] = useState(1);

  const isAuthorized = user?.username === 'hr901027';

  // Fetch overview (skip if not authorized)
  const { data: overview, isLoading } = useSWR<OverviewResponse>(
    isAuthorized ? `/api/activity/overview?days=${days}` : null,
  );

  // Fetch timeline when user selected
  const { data: timeline, isLoading: timelineLoading } = useSWR<TimelineResponse>(
    isAuthorized && selectedUser
      ? `/api/activity/user/${selectedUser.user_id}?days=${days}&page=${timelinePage}`
      : null,
  );

  // Filter users by search
  const filteredUsers = useMemo(() => {
    if (!overview?.users) return [];
    if (!search.trim()) return overview.users;
    const q = search.toLowerCase();
    return overview.users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.employee_name || '').toLowerCase().includes(q),
    );
  }, [overview?.users, search]);

  // Calculate max actions for progress bar scaling
  const maxActions = useMemo(() => {
    if (!overview?.users?.length) return 1;
    return Math.max(...overview.users.map((u) => u.total_actions), 1);
  }, [overview?.users]);

  // Access guard: redirect non-authorized users
  if (user && !isAuthorized) {
    router.replace('/admin/briefing');
    return null;
  }
  if (!isAuthorized) return null;

  // --- Detail View ---
  if (selectedUser) {
    const timelineGroups = timeline ? groupByDate(timeline.items) : [];

    const breakdown = selectedUser.breakdown || {};
    const topResources = Object.entries(breakdown)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4);

    return (
      <div className="min-h-screen">
        {/* Header */}
        <header className="island-header glass-nav px-[1.125rem] py-3 flex items-center gap-3">
          <button
            onClick={() => { setSelectedUser(null); setTimelinePage(1); }}
            className="text-gray-500 active:text-gray-800"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 flex-1">
            {selectedUser.employee_name || selectedUser.username}
          </h1>
          <UserMenu />
        </header>

        <div className="px-4 space-y-3 island-page-top island-page-bottom">
          {/* User summary card */}
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg ${avatarColor(selectedUser.employee_name || selectedUser.username)}`}>
                {(selectedUser.employee_name || selectedUser.username).charAt(0)}
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900">
                  {selectedUser.employee_name || selectedUser.username}
                </div>
                <div className="text-sm text-gray-500">
                  {ROLE_MAP[selectedUser.role_code] || selectedUser.role_code} · 最后活跃 {relativeTime(selectedUser.last_active)}
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-2 pt-3 border-t border-gray-50">
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900">{selectedUser.total_actions}</div>
                <div className="text-xs text-gray-500">总操作</div>
              </div>
              {topResources.map(([type, count]) => {
                const config = RESOURCE_CONFIG[type] || RESOURCE_CONFIG.other;
                return (
                  <div key={type} className="text-center">
                    <div className="text-lg font-bold text-gray-900">{count}</div>
                    <div className="text-xs text-gray-500">{config.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timeline */}
          {timelineLoading ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <div className="text-sm text-gray-400">加载中...</div>
            </div>
          ) : timelineGroups.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <Activity className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <div className="text-sm text-gray-400">暂无操作记录</div>
            </div>
          ) : (
            timelineGroups.map((group) => (
              <div key={group.date}>
                <div className="text-xs font-semibold text-gray-400 px-1 mb-1.5">
                  {group.label}
                </div>
                <div className="glass-card rounded-2xl overflow-hidden divide-y divide-gray-50">
                  {group.items.map((item) => {
                    const config = RESOURCE_CONFIG[item.resource_type] || RESOURCE_CONFIG.other;
                    const time = new Date(item.created_at).toLocaleTimeString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'Asia/Shanghai',
                    });
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${config.color}`}>
                          {config.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-900">{getActionLabel(item)}</div>
                          <div className="text-xs text-gray-400 font-mono truncate">
                            {item.method} {item.path}
                          </div>
                        </div>
                        <div className="text-xs text-gray-400 flex-shrink-0">{time}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          {/* Load more */}
          {timeline && timeline.total > timelinePage * timeline.pageSize && (
            <button
              onClick={() => setTimelinePage((p) => p + 1)}
              className="w-full py-3 text-sm text-gray-500 glass-card rounded-xl active:bg-gray-50"
            >
              加载更多
            </button>
          )}
        </div>
      </div>
    );
  }

  // --- Overview View ---
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="island-header glass-nav px-[1.125rem] py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">用户活动</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {days === 7 ? '近 7 天' : '近 30 天'}
          </span>
          <UserMenu />
        </div>
      </header>

      <div className="px-4 space-y-3 island-page-top island-page-bottom">
        {/* Filters */}
        <div className="flex gap-2 items-center">
          <div className="bg-gray-100 rounded-lg p-0.5 flex">
            <button
              onClick={() => setDays(7)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                days === 7
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              7天
            </button>
            <button
              onClick={() => setDays(30)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                days === 30
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              30天
            </button>
          </div>
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索用户..."
              className="w-full text-sm pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 bg-white/60 outline-none focus:border-gray-400 placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Summary cards */}
        {overview && (
          <div className="grid grid-cols-3 gap-2.5">
            <div className="glass-card rounded-xl p-3 text-center">
              <div className="text-xs text-gray-500 mb-1">总用户</div>
              <div className="text-xl font-bold text-gray-900">{overview.total_users}</div>
            </div>
            <div className="glass-card rounded-xl p-3 text-center">
              <div className="text-xs text-gray-500 mb-1">活跃</div>
              <div className="text-xl font-bold text-primary-600">{overview.active_users}</div>
            </div>
            <div className="glass-card rounded-xl p-3 text-center">
              <div className="text-xs text-gray-500 mb-1">沉默</div>
              <div className="text-xl font-bold text-gray-400">{overview.inactive_users}</div>
            </div>
          </div>
        )}

        {/* User list */}
        {isLoading ? (
          <div className="glass-card rounded-2xl p-8 text-center">
            <div className="text-sm text-gray-400">加载中...</div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center">
            <Activity className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <div className="text-sm text-gray-400">暂无用户数据</div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredUsers.map((u) => {
              const activityPct = Math.round((u.total_actions / maxActions) * 100);
              const isInactive = u.total_actions === 0;

              const topTags = Object.entries(u.breakdown)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 4);

              return (
                <div
                  key={u.user_id}
                  onClick={() => { setSelectedUser(u); setTimelinePage(1); }}
                  className="glass-card rounded-2xl p-3.5 active:bg-gray-50 cursor-pointer"
                >
                  {/* Top row */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm ${isInactive ? 'bg-gray-300' : avatarColor(u.employee_name || u.username)}`}>
                        {(u.employee_name || u.username).charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-gray-900">
                            {u.employee_name || u.username}
                          </span>
                          {isInactive ? (
                            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium">沉默</span>
                          ) : activityPct >= 60 ? (
                            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600 font-medium">活跃</span>
                          ) : null}
                        </div>
                        <div className="text-xs text-gray-500">
                          {ROLE_MAP[u.role_code] || u.role_code}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium text-gray-500 flex items-center gap-1">
                        <Clock size={11} />
                        {relativeTime(u.last_active)}
                      </div>
                      <div className="text-[11px] text-gray-400">最后活跃</div>
                    </div>
                  </div>

                  {/* Activity bar */}
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>活跃度</span>
                      <span>{activityPct}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100/60 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all bg-primary-500"
                        style={{ width: `${Math.max(activityPct, 2)}%` }}
                      />
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex gap-1.5 flex-wrap">
                    {topTags.length > 0 ? topTags.map(([type, count]) => {
                      const config = RESOURCE_CONFIG[type] || RESOURCE_CONFIG.other;
                      return (
                        <span key={type} className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${config.color}`}>
                          {config.icon} {config.label} {count}
                        </span>
                      );
                    }) : (
                      <span className="text-[11px] text-gray-400">无操作记录</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
