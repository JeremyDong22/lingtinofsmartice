// BrandCharts - Brand-level visualization: sparkline trends + distribution bars
// Renders below brand KPI bar, always visible (no expand needed)

'use client';

import { useId } from 'react';
import useSWR from 'swr';

interface TrendPoint {
  date: string;
  avg_sentiment?: number;
  resolution_rate?: number;
  count?: number;
}

interface BrandKpiData {
  satisfaction_trend: TrendPoint[];
  resolution_trend: TrendPoint[];
  problem_distribution: Record<string, number>;
  action_aging: { under3: number; days3to7: number; over7: number };
}

interface BrandChartsProps {
  brandId: number;
  days?: number;
  managedIdsParam?: string;
}

// --- SVG Sparkline ---
function Sparkline({
  data,
  label,
  unit,
  valueKey,
  healthColor,
}: {
  data: TrendPoint[];
  label: string;
  unit: string;
  valueKey: 'avg_sentiment' | 'resolution_rate';
  healthColor: string;
}) {
  if (!data || data.length < 2) return null;

  const W = 320, H = 50, padY = 6;
  const values = data.map(d => (d[valueKey] as number) ?? 0);
  const min = Math.min(...values) - 5;
  const max = Math.max(...values) + 5;
  const range = max - min || 1;

  const points = values.map((v, i) => ({
    x: (i / (values.length - 1)) * W,
    y: H - padY - ((v - min) / range) * (H - 2 * padY),
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaD = pathD + ` L${W},${H} L0,${H} Z`;

  const colorMap: Record<string, string> = {
    green: '#4C7A56',
    yellow: '#A18D50',
    red: '#9E5440',
  };
  const strokeColor = colorMap[healthColor] || colorMap.yellow;
  const lastVal = Math.round(values[values.length - 1]);
  const firstDate = data[0].date.slice(5);  // MM-DD
  const lastDate = data[data.length - 1].date.slice(5);
  const reactId = useId();
  const gradId = `grad-${reactId}-${valueKey}`;

  const textColor = healthColor === 'green' ? 'text-green-600'
    : healthColor === 'red' ? 'text-red-600' : 'text-yellow-600';

  return (
    <div className="bg-white/40 rounded-lg p-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-gray-400">{label}</span>
        <span className={`text-xs font-semibold ${textColor}`}>{lastVal}{unit}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 50 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gradId})`} />
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={2.5} fill={strokeColor} />
      </svg>
      <div className="flex justify-between mt-0.5">
        <span className="text-[9px] text-gray-300">{firstDate}</span>
        <span className="text-[9px] text-gray-300">{lastDate}</span>
      </div>
    </div>
  );
}

// --- Distribution Bar ---
function DistributionBar({
  label,
  segments,
}: {
  label: string;
  segments: { name: string; value: number; color: string }[];
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-400 w-12 flex-shrink-0 text-right">{label}</span>
      <div className="flex-1 flex rounded-full h-2 overflow-hidden">
        {segments.map((seg, i) => {
          const pct = (seg.value / total) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={i}
              className={`${seg.color} transition-all`}
              style={{ width: `${pct.toFixed(1)}%` }}
              title={`${seg.name}: ${seg.value}`}
            />
          );
        })}
      </div>
      <span className="text-[10px] text-gray-400 w-6 flex-shrink-0">{total}</span>
    </div>
  );
}

// Category label mapping
const CATEGORY_LABELS: Record<string, string> = {
  dish_quality: '菜品',
  service_speed: '服务',
  staff_attitude: '态度',
  environment: '环境',
};

const CATEGORY_COLORS: Record<string, string> = {
  dish_quality: 'bg-red-400',
  service_speed: 'bg-yellow-400',
  staff_attitude: 'bg-amber-400',
  environment: 'bg-primary-300',
};

function getHealthColor(value: number, thresholds: [number, number]): string {
  if (value >= thresholds[0]) return 'green';
  if (value >= thresholds[1]) return 'yellow';
  return 'red';
}

export function BrandCharts({ brandId, days = 30, managedIdsParam = '' }: BrandChartsProps) {
  const { data, isLoading } = useSWR<BrandKpiData>(
    brandId != null ? `/api/dashboard/brand-kpi?brand_id=${brandId}&days=${days}${managedIdsParam}` : null,
  );

  if (isLoading || !data) return null;

  const { satisfaction_trend, resolution_trend, problem_distribution, action_aging } = data;

  // Determine health colors from latest values
  const lastSentiment = satisfaction_trend.length > 0
    ? satisfaction_trend[satisfaction_trend.length - 1].avg_sentiment ?? 0
    : 0;
  const lastResolution = resolution_trend.length > 0
    ? resolution_trend[resolution_trend.length - 1].resolution_rate ?? 0
    : 0;

  // Build problem distribution segments
  const problemSegments = Object.entries(problem_distribution)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, value]) => ({
      name: CATEGORY_LABELS[cat] || cat,
      value,
      color: CATEGORY_COLORS[cat] || 'bg-gray-300',
    }));

  // Action aging segments
  const agingSegments = [
    { name: '<3天', value: action_aging.under3, color: 'bg-green-400' },
    { name: '3-7天', value: action_aging.days3to7, color: 'bg-yellow-400' },
    { name: '>7天', value: action_aging.over7, color: 'bg-red-400' },
  ];

  const hasTrends = satisfaction_trend.length >= 2 || resolution_trend.length >= 2;
  const hasBars = problemSegments.some(s => s.value > 0) ||
    agingSegments.some(s => s.value > 0);

  if (!hasTrends && !hasBars) return null;

  return (
    <div className="space-y-2 px-4 pb-2 ml-[1.625rem]">
      {satisfaction_trend.length >= 2 && (
        <Sparkline
          data={satisfaction_trend}
          label="满意度趋势"
          unit="分"
          valueKey="avg_sentiment"
          healthColor={getHealthColor(lastSentiment, [70, 50])}
        />
      )}
      {resolution_trend.length >= 2 && (
        <Sparkline
          data={resolution_trend}
          label="解决率趋势"
          unit="%"
          valueKey="resolution_rate"
          healthColor={getHealthColor(lastResolution, [60, 30])}
        />
      )}
      {problemSegments.some(s => s.value > 0) && (
        <DistributionBar label="问题分布" segments={problemSegments} />
      )}
      {agingSegments.some(s => s.value > 0) && (
        <DistributionBar label="行动老化" segments={agingSegments} />
      )}
    </div>
  );
}
