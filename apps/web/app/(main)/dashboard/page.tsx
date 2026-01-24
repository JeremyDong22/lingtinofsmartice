// Dashboard Page - Business metrics and analytics
// v1.0

'use client';

import { useState } from 'react';

// Mock data for demo - will be replaced with real API calls
const MOCK_COVERAGE = {
  periods: [
    { period: 'lunch', open_count: 50, visit_count: 42, coverage: 84, status: 'warning' },
    { period: 'dinner', open_count: 68, visit_count: 65, coverage: 96, status: 'good' },
  ],
};

const MOCK_DISHES = {
  dishes: [
    { dish_name: '油焖大虾', mention_count: 20, positive: 18, negative: 2 },
    { dish_name: '招牌红烧肉', mention_count: 16, positive: 15, negative: 1 },
    { dish_name: '清蒸鲈鱼', mention_count: 15, positive: 12, negative: 3 },
    { dish_name: '蒜蓉粉丝虾', mention_count: 10, positive: 10, negative: 0 },
    { dish_name: '宫保鸡丁', mention_count: 10, positive: 8, negative: 2 },
  ],
};

const MOCK_HIGHLIGHTS = {
  positive: [
    { text: '您觉得咱家招牌菜味道怎么样？', table: 'B4', time: '12:30' },
    { text: '今天的鲈鱼是早上刚到的，特别新鲜', table: 'A7', time: '13:15' },
  ],
  negative: [
    { text: '还行吧', suggestion: '建议引导具体菜品反馈' },
    { text: '嗯嗯好的', suggestion: '建议主动询问用餐体验' },
  ],
};

export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState('今日');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">数据看板</h1>
        <select
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option>今日</option>
          <option>昨日</option>
          <option>本周</option>
        </select>
      </header>

      <main className="p-4 space-y-4">
        {/* Coverage Table */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-medium text-gray-700 mb-3">执行匹配流</h2>
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
                {MOCK_COVERAGE.periods.map((row) => (
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
                      ) : (
                        <span className="text-yellow-600">
                          ⚠ -{row.open_count - row.visit_count}桌
                        </span>
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
            {MOCK_DISHES.dishes.map((dish, i) => (
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
          <div className="flex items-center justify-around py-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">78%</div>
              <div className="text-xs text-gray-500 mt-1">正面情绪</div>
            </div>
            <div className="h-12 w-px bg-gray-200" />
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-600">15%</div>
              <div className="text-xs text-gray-500 mt-1">中性情绪</div>
            </div>
            <div className="h-12 w-px bg-gray-200" />
            <div className="text-center">
              <div className="text-3xl font-bold text-red-500">7%</div>
              <div className="text-xs text-gray-500 mt-1">负面情绪</div>
            </div>
          </div>
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
              {MOCK_HIGHLIGHTS.positive.map((item, i) => (
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
              {MOCK_HIGHLIGHTS.negative.map((item, i) => (
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
