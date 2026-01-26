// Dashboard Page - Business metrics and analytics
// v1.4 - Added UserMenu component for user info and logout

'use client';

import { useState, useEffect } from 'react';
import { getAuthHeaders } from '@/contexts/AuthContext';
import { UserMenu } from '@/components/layout/UserMenu';

// Must match DEFAULT_RESTAURANT_ID in backend supabase.service.ts
const DEMO_RESTAURANT_ID = '0b9e9031-4223-4124-b633-e3a853abfb8f';

// Types for API responses
interface CoveragePeriod {
  period: string;
  open_count: number;
  visit_count: number;
  coverage: number;
  status: 'good' | 'warning' | 'critical';
}

interface DishRanking {
  dish_name: string;
  mention_count: number;
  positive: number;
  negative: number;
  neutral: number;
}

interface SentimentSummary {
  positive_count: number;
  neutral_count: number;
  negative_count: number;
  positive_percent: number;
  neutral_percent: number;
  negative_percent: number;
  total_visits: number;
}

interface HighlightPositive {
  text: string;
  table: string;
  time: string;
}

interface HighlightNegative {
  text: string;
  suggestion: string;
}

// Calculate date based on selection
function getDateForSelection(selection: string): string {
  const date = new Date();
  if (selection === '昨日') {
    date.setDate(date.getDate() - 1);
  }
  return date.toISOString().split('T')[0];
}

export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState('今日');
  const [loading, setLoading] = useState(true);

  // API data states
  const [coverage, setCoverage] = useState<{ periods: CoveragePeriod[] }>({ periods: [] });
  const [dishes, setDishes] = useState<{ dishes: DishRanking[] }>({ dishes: [] });
  const [sentiment, setSentiment] = useState<SentimentSummary | null>(null);
  const [highlights, setHighlights] = useState<{
    positive: HighlightPositive[];
    negative: HighlightNegative[];
  }>({ positive: [], negative: [] });

  // Fetch all dashboard data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const date = getDateForSelection(selectedDate);
      const params = new URLSearchParams({
        restaurant_id: DEMO_RESTAURANT_ID,
        date,
      });

      try {
        const headers = getAuthHeaders();
        // Fetch all data in parallel
        const [coverageRes, dishesRes, sentimentRes, highlightsRes] = await Promise.all([
          fetch(`/api/dashboard/coverage?${params}`, { headers }),
          fetch(`/api/dashboard/dish-ranking?${params}&limit=5`, { headers }),
          fetch(`/api/dashboard/sentiment-summary?${params}`, { headers }),
          fetch(`/api/dashboard/speech-highlights?${params}`, { headers }),
        ]);

        if (coverageRes.ok) {
          const data = await coverageRes.json();
          setCoverage(data);
        }

        if (dishesRes.ok) {
          const data = await dishesRes.json();
          setDishes(data);
        }

        if (sentimentRes.ok) {
          const data = await sentimentRes.json();
          setSentiment(data);
        }

        if (highlightsRes.ok) {
          const data = await highlightsRes.json();
          setHighlights(data);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedDate]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">数据看板</h1>
        <div className="flex items-center gap-3">
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
          >
            <option>今日</option>
            <option>昨日</option>
          </select>
          <UserMenu />
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Loading indicator */}
        {loading && (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        )}

        {/* Coverage Table */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-medium text-gray-700 mb-3">执行覆盖率</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-100">
                  <th className="text-left py-2 font-medium">时段</th>
                  <th className="text-center py-2 font-medium">开台</th>
                  <th className="text-center py-2 font-medium">桌访</th>
                  <th className="text-center py-2 font-medium">覆盖率</th>
                  <th className="text-right py-2 font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {coverage.periods.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-gray-400">
                      暂无数据
                    </td>
                  </tr>
                )}
                {coverage.periods.map((row) => (
                  <tr key={row.period} className="border-b border-gray-50">
                    <td className="py-3 font-medium">
                      {row.period === 'lunch' ? '午市' : '晚市'}
                    </td>
                    <td className="text-center text-gray-600">{row.open_count}</td>
                    <td className="text-center text-gray-600">{row.visit_count}</td>
                    <td className="text-center">
                      <span
                        className={`font-medium ${
                          row.status === 'good'
                            ? 'text-green-600'
                            : row.status === 'warning'
                              ? 'text-yellow-600'
                              : 'text-red-600'
                        }`}
                      >
                        {row.coverage}%
                      </span>
                    </td>
                    <td className="text-right">
                      {row.status === 'good' ? (
                        <span className="text-green-600">✓ 正常</span>
                      ) : row.open_count > row.visit_count ? (
                        <span className="text-yellow-600">
                          ⚠ -{row.open_count - row.visit_count}桌
                        </span>
                      ) : (
                        <span className="text-green-600">✓ 正常</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dish Ranking */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-medium text-gray-700 mb-3">菜品提及 TOP 5</h2>
          <div className="space-y-3">
            {dishes.dishes.length === 0 && !loading && (
              <div className="text-center py-4 text-gray-400">暂无数据</div>
            )}
            {dishes.dishes.map((dish, i) => (
              <div
                key={dish.dish_name}
                className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg w-6">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                  </span>
                  <div>
                    <span className="text-gray-900 font-medium">{dish.dish_name}</span>
                    <span className="text-gray-400 text-xs ml-2">
                      {dish.mention_count}次提及
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-green-600">{dish.positive}👍</span>
                  {dish.negative > 0 && (
                    <span className="text-red-500">{dish.negative}👎</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sentiment Summary */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-medium text-gray-700 mb-3">情绪概览</h2>
          {sentiment ? (
            <div className="flex items-center justify-around py-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {sentiment.positive_percent}%
                </div>
                <div className="text-xs text-gray-500 mt-1">正面情绪</div>
              </div>
              <div className="h-12 w-px bg-gray-200" />
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-600">
                  {sentiment.neutral_percent}%
                </div>
                <div className="text-xs text-gray-500 mt-1">中性情绪</div>
              </div>
              <div className="h-12 w-px bg-gray-200" />
              <div className="text-center">
                <div className="text-3xl font-bold text-red-500">
                  {sentiment.negative_percent}%
                </div>
                <div className="text-xs text-gray-500 mt-1">负面情绪</div>
              </div>
            </div>
          ) : !loading ? (
            <div className="text-center py-4 text-gray-400">暂无数据</div>
          ) : null}
        </div>

        {/* Speech Highlights */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-medium text-gray-700 mb-3">话术红黑榜</h2>

          {/* Positive Examples */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-green-600">✓</span>
              <span className="text-xs font-medium text-gray-600">优秀话术</span>
            </div>
            <div className="space-y-2">
              {highlights.positive.length === 0 && !loading && (
                <div className="text-center py-2 text-gray-400 text-sm">暂无数据</div>
              )}
              {highlights.positive.map((item, i) => (
                <div
                  key={i}
                  className="bg-green-50 rounded-lg p-3 text-sm text-green-800"
                >
                  "{item.text}"
                  <span className="text-green-600 text-xs ml-2">
                    - {item.table}桌 {item.time}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Negative Examples */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-yellow-600">⚠</span>
              <span className="text-xs font-medium text-gray-600">待改进</span>
            </div>
            <div className="space-y-2">
              {highlights.negative.length === 0 && !loading && (
                <div className="text-center py-2 text-gray-400 text-sm">暂无数据</div>
              )}
              {highlights.negative.map((item, i) => (
                <div key={i} className="bg-yellow-50 rounded-lg p-3 text-sm">
                  <div className="text-yellow-800">"{item.text}"</div>
                  <div className="text-yellow-600 text-xs mt-1">
                    → {item.suggestion}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
