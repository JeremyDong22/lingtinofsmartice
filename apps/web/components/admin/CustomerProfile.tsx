// Customer Profile Tab - Visit frequency + source channel analytics
// Shows overview card + per-restaurant breakdown with expand/collapse

'use client';

import { useState } from 'react';
import useSWR from 'swr';

interface FrequencyData {
  first: number;
  repeat: number;
  regular: number;
  unknown: number;
  no_data: number;
}

interface SourceItem {
  source: string;
  count: number;
  ratio: number;
}

interface RestaurantProfile {
  restaurant_id: string;
  restaurant_name: string;
  total_visits: number;
  repeat_ratio: number | null;
  frequency: FrequencyData;
  source_distribution: SourceItem[];
  data_coverage: number;
}

interface ProfileResponse {
  summary: {
    total_visits: number;
    repeat_ratio: number | null;
    frequency: FrequencyData;
    source_distribution: SourceItem[];
    data_coverage: number;
  };
  by_restaurant: RestaurantProfile[];
}

interface CustomerProfileProps {
  startDate: string;
  endDate: string;
  managedIdsParam?: string;
}

export function CustomerProfile({ startDate, endDate, managedIdsParam = '' }: CustomerProfileProps) {
  const { data, isLoading } = useSWR<ProfileResponse>(
    `/api/dashboard/customer-profile?start_date=${startDate}&end_date=${endDate}${managedIdsParam}`,
  );

  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-3" />
            <div className="h-3 bg-gray-100 rounded w-full mb-2" />
            <div className="h-3 bg-gray-100 rounded w-4/5" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { summary, by_restaurant } = data;
  const coverage = summary.data_coverage;
  const freq = summary.frequency;
  const withData = freq.first + freq.repeat + freq.regular + freq.unknown;

  // Low data state
  if (coverage < 30 && withData === 0) {
    return (
      <div className="bg-white rounded-xl p-6 text-center">
        <div className="text-4xl mb-3">📊</div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">数据积累中</h3>
        <p className="text-sm text-gray-500">
          新录音将自动提取客户画像信息（来源渠道、到店频次）
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Overview card */}
      <div className="bg-white rounded-2xl p-4 space-y-3">
        {/* Frequency bar */}
        <div>
          <FrequencyBar frequency={freq} />
          <div className="mt-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900">
              老客占比{' '}
              <span className={summary.repeat_ratio != null
                ? (summary.repeat_ratio >= 40 ? 'text-green-600' : 'text-yellow-600')
                : 'text-gray-400'
              }>
                {summary.repeat_ratio != null ? `${summary.repeat_ratio}%` : '--'}
              </span>
            </div>
          </div>
        </div>

        {/* Top sources */}
        {summary.source_distribution.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 mb-1.5">主要来源</div>
            <SourceList sources={summary.source_distribution.slice(0, 5)} />
          </div>
        )}

        {/* Data coverage note */}
        {coverage > 0 && coverage < 80 && (
          <p className="text-xs text-gray-400">
            基于 {coverage}% 桌访数据
          </p>
        )}
      </div>

      {/* Per-restaurant list */}
      {by_restaurant.length > 0 && (
        <div className="space-y-2">
          {by_restaurant.map(rest => {
            const isExpanded = expandedId === rest.restaurant_id;
            const topSource = rest.source_distribution[0];

            return (
              <div key={rest.restaurant_id} className="bg-white rounded-2xl overflow-hidden">
                {/* Restaurant summary row */}
                <div
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer active:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : rest.restaurant_id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {rest.restaurant_name}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                      <span className={
                        rest.repeat_ratio != null
                          ? (rest.repeat_ratio >= 40 ? 'text-green-600' : 'text-yellow-600')
                          : 'text-gray-400'
                      }>
                        老客 {rest.repeat_ratio != null ? `${rest.repeat_ratio}%` : '--'}
                      </span>
                      {topSource && (
                        <>
                          <span>·</span>
                          <span>首要来源: {topSource.source}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-300 transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                    <FrequencyBar frequency={rest.frequency} />
                    {rest.source_distribution.length > 0 && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1.5">来源渠道</div>
                        <SourceList sources={rest.source_distribution} />
                      </div>
                    )}
                    {rest.data_coverage > 0 && rest.data_coverage < 80 && (
                      <p className="text-xs text-gray-400">
                        基于 {rest.data_coverage}% 数据
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Inline sub-components ---

function FrequencyBar({ frequency }: { frequency: FrequencyData }) {
  // Include unknown in total to match backend repeat_ratio denominator
  const total = frequency.first + frequency.repeat + frequency.regular + frequency.unknown;
  if (total === 0) {
    return (
      <div className="h-6 bg-gray-100 rounded-full flex items-center justify-center">
        <span className="text-xs text-gray-400">暂无频次数据</span>
      </div>
    );
  }
  const firstPct = Math.round((frequency.first / total) * 100);
  const repeatPct = Math.round((frequency.repeat / total) * 100);
  const regularPct = Math.round((frequency.regular / total) * 100);
  const unknownPct = Math.max(0, 100 - firstPct - repeatPct - regularPct);

  return (
    <div>
      <div className="flex h-6 rounded-full overflow-hidden">
        {firstPct > 0 && (
          <div className="bg-teal-400 flex items-center justify-center" style={{ width: `${firstPct}%` }}>
            {firstPct >= 15 && <span className="text-[10px] text-white font-medium">{firstPct}%</span>}
          </div>
        )}
        {repeatPct > 0 && (
          <div className="bg-green-500 flex items-center justify-center" style={{ width: `${repeatPct}%` }}>
            {repeatPct >= 15 && <span className="text-[10px] text-white font-medium">{repeatPct}%</span>}
          </div>
        )}
        {regularPct > 0 && (
          <div className="bg-green-700 flex items-center justify-center" style={{ width: `${regularPct}%` }}>
            {regularPct >= 15 && <span className="text-[10px] text-white font-medium">{regularPct}%</span>}
          </div>
        )}
        {unknownPct > 0 && (
          <div className="bg-gray-300 flex items-center justify-center" style={{ width: `${unknownPct}%` }}>
            {unknownPct >= 15 && <span className="text-[10px] text-gray-600 font-medium">{unknownPct}%</span>}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-teal-400" />新客 {firstPct}%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" />回头客 {repeatPct}%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-700" />常客 {regularPct}%
        </span>
        {unknownPct > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-300" />未知 {unknownPct}%
          </span>
        )}
      </div>
    </div>
  );
}

function SourceList({ sources }: { sources: SourceItem[] }) {
  const maxRatio = sources[0]?.ratio || 1;
  return (
    <div className="space-y-1.5">
      {sources.map(s => (
        <div key={s.source} className="flex items-center gap-2">
          <span className="text-xs text-gray-700 w-16 text-right flex-shrink-0 truncate">{s.source}</span>
          <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-200 rounded-full"
              style={{ width: `${(s.ratio / maxRatio) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 w-8 text-right flex-shrink-0">{s.ratio}%</span>
        </div>
      ))}
    </div>
  );
}
