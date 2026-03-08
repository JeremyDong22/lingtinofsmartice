// BrandCharts - Brand-level KPI + visualizations in glass card sections
// Direction B: Card Sections — 结构清晰 · 层次分明 · 卡片节奏
// KPI glass card | Trend glass cards (55px) | Problem + Aging side-by-side glass cards

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

// --- KPI Cell ---
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

// --- Sparkline (55px glass card, reduced opacity stroke) ---
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

  const W = 320, H = 55, padY = 6;
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
    <div className="glass-card rounded-2xl p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-gray-400">{label}</span>
        <span className={`text-[11px] font-semibold ${textColorClass}`}>{lastVal}{unit}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 55 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity={0.12} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gradId})`} />
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth={1.5} strokeOpacity={0.7} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={2.5} fill="#fff" stroke={strokeColor} strokeWidth={1.5} />
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

// Warm tones with reduced saturation (opacity 0.65 on bars)
const CATEGORY_BG = 'rgba(233,213,206,0.4)';
const CATEGORY_STYLES: Record<string, { color: string; bg: string; textClass: string }> = {
  dish_quality: { color: '#e11d48', bg: CATEGORY_BG, textClass: 'text-[#881337]' },
  service_speed: { color: '#f97316', bg: CATEGORY_BG, textClass: 'text-[#9a3412]' },
  staff_attitude: { color: '#f59e0b', bg: CATEGORY_BG, textClass: 'text-[#78350f]' },
  environment: { color: '#eab308', bg: CATEGORY_BG, textClass: 'text-[#854d0e]' },
};

const DEFAULT_CAT_STYLE = { color: '#a1a1aa', bg: 'rgba(0,0,0,0.04)', textClass: 'text-gray-500' };

const AGING_ITEMS: { key: keyof BrandKpiData['action_aging']; label: string; bg: string; color: string }[] = [
  { key: 'under3', label: '<3天', bg: 'rgba(245,158,11,0.06)', color: '#78350f' },
  { key: 'days3to7', label: '3-7天', bg: 'rgba(249,115,22,0.06)', color: '#9a3412' },
  { key: 'over7', label: '>7天', bg: 'rgba(225,29,72,0.06)', color: '#881337' },
];

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

  const hasAging = action_aging.under3 > 0 || action_aging.days3to7 > 0 || action_aging.over7 > 0;

  return (
    <div className="px-4 pb-2 flex flex-col gap-2.5">
      {/* KPI Card */}
      <div className="glass-card rounded-2xl py-3.5 px-2">
        <div className="flex items-center justify-around">
          <KpiCell
            label="满意度"
            value={summary_kpi.avg_sentiment}
            unit="分"
            color={getKpiColor(summary_kpi.avg_sentiment, [70, 50])}
          />
          <span className="w-px h-[22px]" style={{ background: 'rgba(0,0,0,0.06)' }} />
          <KpiCell
            label="老客占比"
            value={summary_kpi.repeat_ratio}
            unit="%"
            color={getKpiColor(summary_kpi.repeat_ratio, [40, 20])}
          />
          <span className="w-px h-[22px]" style={{ background: 'rgba(0,0,0,0.06)' }} />
          <KpiCell
            label="复盘率"
            value={reviewRate != null ? Math.round(reviewRate) : null}
            unit="%"
            color={getKpiColor(reviewRate != null ? Math.round(reviewRate) : null, [80, 50])}
          />
          <span className="w-px h-[22px]" style={{ background: 'rgba(0,0,0,0.06)' }} />
          <KpiCell
            label="解决率"
            value={summary_kpi.resolution_rate}
            unit="%"
            color={getKpiColor(summary_kpi.resolution_rate, [60, 30])}
          />
        </div>
      </div>

      {/* Trend Cards — individual glass cards */}
      {satisfaction_trend.length >= 2 && (
        <Sparkline
          data={satisfaction_trend}
          label="满意度趋势"
          unit="分"
          valueKey="avg_sentiment"
          strokeColor="#e11d48"
          textColorClass="text-[#c2410c]"
        />
      )}
      {resolution_trend.length >= 2 && (
        <Sparkline
          data={resolution_trend}
          label="解决率趋势"
          unit="%"
          valueKey="resolution_rate"
          strokeColor="#f97316"
          textColorClass="text-[#ea580c]"
        />
      )}

      {/* Problem Distribution + Action Aging — side by side glass cards */}
      {(problemTotal > 0 || hasAging) && (
        <div className="flex gap-2.5">
          {/* Problem Distribution Card */}
          {problemTotal > 0 && (
            <div className={`glass-card rounded-2xl p-3 ${hasAging ? 'flex-1 min-w-0' : 'w-full'}`}>
              <div className="text-[10px] text-gray-400 mb-2">问题分布</div>
              <div className="flex flex-col gap-1.5">
                {problemEntries.map(([cat, value]) => {
                  if (value <= 0) return null;
                  const style = CATEGORY_STYLES[cat] || DEFAULT_CAT_STYLE;
                  const pct = (value / problemTotal) * 100;
                  return (
                    <div key={cat} className="flex items-center gap-[5px]">
                      <span className={`text-[10px] font-medium w-[22px] text-right flex-shrink-0 ${style.textClass}`}>
                        {CATEGORY_LABELS[cat] || cat}
                      </span>
                      <div className="flex-1 h-[5px] rounded-[3px] overflow-hidden" style={{ background: style.bg }}>
                        <div
                          className="h-full rounded-[3px]"
                          style={{ width: `${Math.max(pct, 6).toFixed(1)}%`, background: style.color, opacity: 0.65 }}
                        />
                      </div>
                      <span className={`text-[10px] font-semibold w-3.5 flex-shrink-0 ${style.textClass}`}>{value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Aging Card — list style */}
          {hasAging && (
            <div className={`glass-card rounded-2xl p-3 ${problemTotal > 0 ? 'flex-1 min-w-0' : 'w-full'}`}>
              <div className="text-[10px] text-gray-400 mb-2">行动老化</div>
              <div className="flex flex-col gap-1.5">
                {AGING_ITEMS.map(({ key, label, bg, color }) => (
                  <div key={key} className="flex items-center justify-between py-1.5 px-2 rounded-md" style={{ background: bg }}>
                    <span className="text-[10px] font-medium" style={{ color }}>{label}</span>
                    <span className="text-[15px] font-bold" style={{ color }}>{action_aging[key]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
