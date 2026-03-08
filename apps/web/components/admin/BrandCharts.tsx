// BrandCharts - Brand-level KPI bar + compact visualizations
// KPI: 横排均分数字在上 | 趋势: 50px面积图+首尾日期 | 问题: 独立条形 | 老化: 三格卡片
// 配色: KPI保持健康色, 趋势/问题/老化统一暖色系(珊瑚→桃→杏→沙)

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
  summary_kpi: {
    avg_sentiment: number | null;
    repeat_ratio: number | null;
    resolution_rate: number | null;
  };
}

interface BrandChartsProps {
  brandId: number;
  days?: number;
  managedIdsParam?: string;
  reviewRate?: number | null;
}

// --- KPI Cell (数字在上, 标签在下) ---
function KpiCell({ label, value, unit, color }: {
  label: string;
  value: number | null;
  unit: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center min-w-0">
      <span className={`text-lg font-bold leading-tight ${color}`}>
        {value != null ? value : '--'}
        {value != null && <span className="text-[10px] font-normal">{unit}</span>}
      </span>
      <span className="text-[10px] text-gray-400 leading-tight">{label}</span>
    </div>
  );
}

function getKpiColor(value: number | null, thresholds: [number, number]): string {
  if (value == null) return 'text-gray-400';
  if (value >= thresholds[0]) return 'text-green-600';
  if (value >= thresholds[1]) return 'text-amber-600';
  return 'text-red-600';
}

// --- Sparkline (50px + 首尾日期 + 暖色固定双色) ---
function Sparkline({
  data,
  label,
  unit,
  valueKey,
  strokeColor,
  textColorClass,
}: {
  data: TrendPoint[];
  label: string;
  unit: string;
  valueKey: 'avg_sentiment' | 'resolution_rate';
  strokeColor: string;
  textColorClass: string;
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

  const lastVal = Math.round(values[values.length - 1]);
  const firstDate = data[0].date.slice(5);
  const lastDate = data[data.length - 1].date.slice(5);
  const reactId = useId();
  const gradId = `grad-${reactId}-${valueKey}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-gray-400">{label}</span>
        <span className={`text-xs font-semibold ${textColorClass}`}>{lastVal}{unit}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 50 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gradId})`} />
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={3} fill="#fff" stroke={strokeColor} strokeWidth={2} />
      </svg>
      <div className="flex justify-between mt-0.5">
        <span className="text-[9px] text-gray-300">{firstDate}</span>
        <span className="text-[9px] text-gray-300">{lastDate}</span>
      </div>
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

// 暖色系: 珊瑚→桃→杏→沙
const CATEGORY_STYLES: Record<string, { color: string; bg: string; textClass: string }> = {
  dish_quality: { color: '#e11d48', bg: '#fff1f2', textClass: 'text-[#881337]' },
  service_speed: { color: '#f97316', bg: '#fff7ed', textClass: 'text-[#9a3412]' },
  staff_attitude: { color: '#f59e0b', bg: '#fffbeb', textClass: 'text-[#78350f]' },
  environment: { color: '#eab308', bg: '#fefce8', textClass: 'text-[#854d0e]' },
};

const DEFAULT_CAT_STYLE = { color: '#a1a1aa', bg: '#f5f5f4', textClass: 'text-gray-500' };

export function BrandCharts({ brandId, days = 30, managedIdsParam = '', reviewRate }: BrandChartsProps) {
  const { data, isLoading } = useSWR<BrandKpiData>(
    brandId != null ? `/api/dashboard/brand-kpi?brand_id=${brandId}&days=${days}${managedIdsParam}` : null,
  );

  if (isLoading || !data) return null;

  const { satisfaction_trend, resolution_trend, problem_distribution, action_aging } = data;
  const summary_kpi = data.summary_kpi ?? { avg_sentiment: null, repeat_ratio: null, resolution_rate: null };

  // Problem distribution: sorted by count desc
  const problemEntries = Object.entries(problem_distribution)
    .sort(([, a], [, b]) => b - a);
  const problemTotal = problemEntries.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="px-4 pb-2 ml-[1.625rem] space-y-2.5">
      {/* KPI Bar - 横排均分, 数字在上, 保持原有健康色 */}
      <div className="flex items-center justify-around rounded-xl py-2.5 px-1" style={{ background: 'rgba(76,122,86,0.04)' }}>
        <KpiCell
          label="满意度"
          value={summary_kpi.avg_sentiment}
          unit="分"
          color={getKpiColor(summary_kpi.avg_sentiment, [70, 50])}
        />
        <span className="w-px h-6 bg-gray-100" />
        <KpiCell
          label="老客占比"
          value={summary_kpi.repeat_ratio}
          unit="%"
          color={getKpiColor(summary_kpi.repeat_ratio, [40, 20])}
        />
        <span className="w-px h-6 bg-gray-100" />
        <KpiCell
          label="复盘率"
          value={reviewRate != null ? Math.round(reviewRate) : null}
          unit="%"
          color={getKpiColor(reviewRate != null ? Math.round(reviewRate) : null, [80, 50])}
        />
        <span className="w-px h-6 bg-gray-100" />
        <KpiCell
          label="解决率"
          value={summary_kpi.resolution_rate}
          unit="%"
          color={getKpiColor(summary_kpi.resolution_rate, [60, 30])}
        />
      </div>

      {/* 趋势图 - 暖色固定: 满意度=珊瑚, 解决率=桃橙 */}
      {satisfaction_trend.length >= 2 && (
        <Sparkline
          data={satisfaction_trend}
          label="满意度趋势"
          unit="分"
          valueKey="avg_sentiment"
          strokeColor="#e11d48"
          textColorClass="text-[#881337]"
        />
      )}
      {resolution_trend.length >= 2 && (
        <Sparkline
          data={resolution_trend}
          label="解决率趋势"
          unit="%"
          valueKey="resolution_rate"
          strokeColor="#f97316"
          textColorClass="text-[#9a3412]"
        />
      )}

      {/* 问题分布 - 暖色系: 珊瑚→桃→杏→沙, 带浅色底条 */}
      {problemTotal > 0 && (
        <div>
          <div className="text-[10px] text-gray-400 mb-1.5">问题分布</div>
          <div className="space-y-1.5">
            {problemEntries.map(([cat, value]) => {
              if (value <= 0) return null;
              const style = CATEGORY_STYLES[cat] || DEFAULT_CAT_STYLE;
              const pct = (value / problemTotal) * 100;
              return (
                <div key={cat} className="flex items-center gap-2">
                  <span className={`text-[10px] font-medium w-6 text-right flex-shrink-0 ${style.textClass}`}>
                    {CATEGORY_LABELS[cat] || cat}
                  </span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: style.bg }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(pct, 4).toFixed(1)}%`, background: style.color }}
                    />
                  </div>
                  <span className={`text-[10px] font-semibold w-4 flex-shrink-0 ${style.textClass}`}>{value}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 行动老化 - 暖色三格卡片: 杏/桃/珊瑚 */}
      {(action_aging.under3 > 0 || action_aging.days3to7 > 0 || action_aging.over7 > 0) && (
        <div>
          <div className="text-[10px] text-gray-400 mb-1.5">行动老化</div>
          <div className="flex gap-1.5">
            <div className="flex-1 rounded-lg py-1.5 text-center" style={{ background: '#fffbeb' }}>
              <div className="text-base font-bold" style={{ color: '#78350f' }}>{action_aging.under3}</div>
              <div className="text-[9px] font-medium" style={{ color: '#f59e0b' }}>&lt;3天</div>
            </div>
            <div className="flex-1 rounded-lg py-1.5 text-center" style={{ background: '#fff7ed' }}>
              <div className="text-base font-bold" style={{ color: '#9a3412' }}>{action_aging.days3to7}</div>
              <div className="text-[9px] font-medium" style={{ color: '#f97316' }}>3-7天</div>
            </div>
            <div className="flex-1 rounded-lg py-1.5 text-center" style={{ background: '#fff1f2' }}>
              <div className="text-base font-bold" style={{ color: '#881337' }}>{action_aging.over7}</div>
              <div className="text-[9px] font-medium" style={{ color: '#e11d48' }}>&gt;7天</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
