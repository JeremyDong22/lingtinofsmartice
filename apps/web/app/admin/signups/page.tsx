// Admin Beta Signups Page - View and manage landing page registrations

'use client';

import { useState, useMemo } from 'react';
import { ArrowLeft, Search, Users, CalendarPlus, Tag, Phone, MapPin, Store, DollarSign, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import useSWR from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { UserMenu } from '@/components/layout/UserMenu';

interface BetaSignup {
  id: string;
  brand: string;
  category: string;
  name: string;
  position: string;
  age: number | null;
  phone: string;
  store_count: string | null;
  annual_revenue: string | null;
  city: string;
  help_text: string | null;
  created_at: string;
}

interface SignupsResponse {
  data: BetaSignup[];
  message: string;
}

// Category color mapping
const CATEGORY_COLORS: Record<string, string> = {
  '中餐': 'bg-red-50 text-red-600',
  '火锅': 'bg-orange-50 text-orange-600',
  '烧烤': 'bg-amber-50 text-amber-600',
  '西餐': 'bg-blue-50 text-blue-600',
  '日料': 'bg-pink-50 text-pink-600',
  '茶饮': 'bg-green-50 text-green-600',
  '烘焙': 'bg-yellow-50 text-yellow-600',
  '快餐': 'bg-purple-50 text-purple-600',
};

function getCategoryStyle(category: string): string {
  return CATEGORY_COLORS[category] || 'bg-gray-50 text-gray-600';
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHr < 24) return `${diffHr} 小时前`;
  if (diffDay < 7) return `${diffDay} 天前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export default function SignupsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isAuthorized = user?.username === 'hr901027';

  const { data: resp, isLoading } = useSWR<SignupsResponse>(
    isAuthorized ? '/api/beta-signup' : null,
  );

  const signups = resp?.data ?? [];

  // Stats
  const totalCount = signups.length;
  const todayCount = signups.filter(s => isToday(s.created_at)).length;
  const categoryMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of signups) {
      map[s.category] = (map[s.category] || 0) + 1;
    }
    return map;
  }, [signups]);
  const topCategories = useMemo(() =>
    Object.entries(categoryMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat, count]) => `${cat}(${count})`)
      .join('、'),
    [categoryMap],
  );

  // Filter
  const filtered = useMemo(() => {
    if (!search.trim()) return signups;
    const q = search.toLowerCase();
    return signups.filter(s =>
      s.brand.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.phone.includes(q) ||
      s.city.toLowerCase().includes(q),
    );
  }, [signups, search]);

  if (!user) return null;

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">无访问权限</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-gray-600">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900">报名管理</h1>
            {totalCount > 0 && (
              <span className="text-xs text-gray-400">{totalCount} 条</span>
            )}
          </div>
          <UserMenu />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Stat Cards */}
        {!isLoading && signups.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                <Users className="w-3.5 h-3.5" />
                总报名
              </div>
              <p className="text-xl font-bold text-gray-900">{totalCount}</p>
            </div>
            <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                <CalendarPlus className="w-3.5 h-3.5" />
                今日新增
              </div>
              <p className="text-xl font-bold text-primary-600">{todayCount}</p>
            </div>
            <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                <Tag className="w-3.5 h-3.5" />
                热门品类
              </div>
              <p className="text-xs font-medium text-gray-700 leading-relaxed">{topCategories || '-'}</p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索品牌、联系人、手机号、城市..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
          />
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-20 text-gray-400 text-sm">
            {search ? '没有匹配的报名记录' : '暂无报名记录'}
          </div>
        )}

        {/* Card List */}
        <div className="space-y-3">
          {filtered.map(signup => {
            const isExpanded = expandedId === signup.id;
            return (
              <div
                key={signup.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all"
              >
                {/* Card Summary */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : signup.id)}
                  className="w-full px-4 py-3 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900 text-sm truncate">
                          {signup.brand}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${getCategoryStyle(signup.category)}`}>
                          {signup.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{signup.name} · {signup.position}</span>
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-3 h-3" />
                          {signup.city}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-400">{formatTime(signup.created_at)}</span>
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4 text-gray-400" />
                        : <ChevronDown className="w-4 h-4 text-gray-400" />
                      }
                    </div>
                  </div>
                  {/* Phone quick action */}
                  <div className="flex items-center gap-2 mt-2">
                    <a
                      href={`tel:${signup.phone}`}
                      onClick={e => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs text-primary-600 bg-primary-50 px-2 py-1 rounded-lg hover:bg-primary-100 transition-colors"
                    >
                      <Phone className="w-3 h-3" />
                      {signup.phone}
                    </a>
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-gray-50 space-y-2">
                    {signup.store_count && (
                      <div className="flex items-center gap-2 text-sm">
                        <Store className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-gray-500">门店数：</span>
                        <span className="text-gray-700">{signup.store_count}</span>
                      </div>
                    )}
                    {signup.annual_revenue && (
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-gray-500">年营收：</span>
                        <span className="text-gray-700">{signup.annual_revenue}</span>
                      </div>
                    )}
                    {signup.age && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-500 ml-5">年龄：</span>
                        <span className="text-gray-700">{signup.age} 岁</span>
                      </div>
                    )}
                    {signup.help_text && (
                      <div className="flex items-start gap-2 text-sm">
                        <MessageSquare className="w-3.5 h-3.5 text-gray-400 mt-0.5" />
                        <div>
                          <span className="text-gray-500">需求：</span>
                          <span className="text-gray-700">{signup.help_text}</span>
                        </div>
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-2 ml-5">
                      报名时间：{new Date(signup.created_at).toLocaleString('zh-CN')}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
