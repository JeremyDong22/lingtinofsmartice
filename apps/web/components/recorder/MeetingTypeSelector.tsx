// Meeting Type Selector - Choose meeting type (pre_meal/daily_review/weekly)
// v2.1 - Replaced emoji icons with lucide-react SVG icons

'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { MeetingType } from '@/hooks/useMeetingStore';
import { UtensilsCrossed, ClipboardList, CalendarDays } from 'lucide-react';

interface MeetingTypeSelectorProps {
  value: MeetingType | '';
  onChange: (type: MeetingType) => void;
  disabled?: boolean;
}

const MEETING_TYPES: Array<{
  type: MeetingType;
  label: string;
  icon: ReactNode;
  hint: string;
  colors: { bg: string; bgActive: string; border: string; text: string };
}> = [
  {
    type: 'pre_meal',
    label: '餐前会',
    icon: <UtensilsCrossed className="w-6 h-6" />,
    hint: '开餐前注意事项',
    colors: { bg: 'bg-orange-50', bgActive: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-700' },
  },
  {
    type: 'daily_review',
    label: '每日复盘',
    icon: <ClipboardList className="w-6 h-6" />,
    hint: '回顾今日表现',
    colors: { bg: 'bg-primary-50', bgActive: 'bg-primary-100', border: 'border-primary-400', text: 'text-primary-700' },
  },
  {
    type: 'weekly',
    label: '周例会',
    icon: <CalendarDays className="w-6 h-6" />,
    hint: '本周综合分析',
    colors: { bg: 'bg-green-50', bgActive: 'bg-green-100', border: 'border-green-400', text: 'text-green-700' },
  },
];

// Smart default: 11:00 前 → 餐前会, 20:00 后 → 每日复盘
function getSmartDefault(): MeetingType | null {
  const now = new Date();
  const chinaOffset = 8 * 60;
  const localOffset = now.getTimezoneOffset();
  const chinaHour = new Date(now.getTime() + (chinaOffset + localOffset) * 60 * 1000).getHours();
  if (chinaHour < 11) return 'pre_meal';
  if (chinaHour >= 20) return 'daily_review';
  return null;
}

export function MeetingTypeSelector({ value, onChange, disabled = false }: MeetingTypeSelectorProps) {
  const hasAutoSelected = useRef(false);

  // Auto-select based on time of day (only once on mount)
  useEffect(() => {
    if (hasAutoSelected.current || value) return;
    hasAutoSelected.current = true;
    const smart = getSmartDefault();
    if (smart) onChange(smart);
  }, [value, onChange]);

  return (
    <div className="glass-card rounded-2xl p-4">
      <h2 className="text-sm font-medium text-gray-700 mb-3">选择会议类型</h2>
      <div className="grid grid-cols-3 gap-2.5">
        {MEETING_TYPES.map(({ type, label, icon, hint, colors }) => {
          const isSelected = value === type;
          return (
            <button
              key={type}
              onClick={() => onChange(type)}
              disabled={disabled}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all border-2 ${
                isSelected
                  ? `${colors.bgActive} ${colors.border} shadow-sm`
                  : `${colors.bg} border-transparent hover:border-gray-200`
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className={isSelected ? colors.text : 'text-gray-500'}>{icon}</span>
              <span className={`text-sm font-medium ${isSelected ? colors.text : 'text-gray-700'}`}>
                {label}
              </span>
              <span className={`text-[10px] leading-tight ${isSelected ? colors.text + ' opacity-70' : 'text-gray-400'}`}>
                {hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
