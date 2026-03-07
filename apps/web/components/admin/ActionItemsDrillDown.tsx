// ActionItemsDrillDown - Expandable pending action items list with voice evidence

'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useT } from '@/lib/i18n';

interface ActionEvidence {
  visitId?: string;
  tableId?: string;
  feedback?: string;
  sentiment?: string;
  audioUrl?: string | null;
}

interface ActionItem {
  id: string;
  action_date: string;
  category: string;
  priority: string;
  status: string;
  suggestion_text: string;
  evidence: ActionEvidence[];
  created_at?: string;
}

interface ActionItemsDrillDownProps {
  restaurantId: string;
  onAudioToggle: (key: string, url: string) => void;
  playingKey: string | null;
}

const priorityColors: Record<string, { dot: string; bg: string; text: string }> = {
  high: { dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700' },
  medium: { dot: 'bg-yellow-400', bg: 'bg-yellow-50', text: 'text-yellow-700' },
  low: { dot: 'bg-gray-400', bg: 'bg-gray-50', text: 'text-gray-600' },
};

function getDaysSince(dateStr: string): number {
  const now = new Date();
  const date = new Date(dateStr + 'T00:00:00+08:00');
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86400000));
}

export function ActionItemsDrillDown({ restaurantId, onAudioToggle, playingKey }: ActionItemsDrillDownProps) {
  const { t } = useT();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useSWR<{ actions: ActionItem[] }>(
    `/api/action-items/pending?restaurant_id=${restaurantId}&include_audio=true&limit=30`
  );

  const actions = data?.actions || [];

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2 py-2">
        {[1, 2].map(i => (
          <div key={i} className="h-12 bg-gray-100 rounded-lg" />
        ))}
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="text-xs text-gray-400 py-3 text-center">
        {t('drillDown.noItems')}
      </div>
    );
  }

  return (
    <div className="space-y-1.5 py-1">
      <div className="text-xs font-medium text-gray-500 mb-1">
        {t('drillDown.pendingItems')} ({actions.length})
      </div>
      {actions.map((item) => {
        const isExpanded = expandedId === item.id;
        const pColor = priorityColors[item.priority] || priorityColors.low;
        const days = getDaysSince(item.action_date);
        const categoryKey = `drillDown.category.${item.category}`;
        const categoryLabel = t(categoryKey) !== categoryKey ? t(categoryKey) : t('drillDown.category.other');

        return (
          <div key={item.id} className="rounded-lg border border-gray-100 overflow-hidden">
            {/* Action item row */}
            <div
              className="flex items-center gap-2 px-2.5 py-2 cursor-pointer active:bg-gray-50 transition-colors"
              onClick={() => setExpandedId(isExpanded ? null : item.id)}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${pColor.dot}`} />
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${pColor.bg} ${pColor.text}`}>
                {categoryLabel}
              </span>
              <p className="text-xs text-gray-700 flex-1 truncate">{item.suggestion_text}</p>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {days > 0 && (
                  <span className={`text-[10px] ${days >= 3 ? 'text-red-500' : 'text-gray-400'}`}>
                    {t('drillDown.days', days)}
                  </span>
                )}
                <svg
                  className={`w-3.5 h-3.5 text-gray-300 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Expanded evidence */}
            {isExpanded && (
              <div className="px-3 pb-2.5 border-t border-gray-50">
                <p className="text-xs text-gray-600 py-2 leading-relaxed">{item.suggestion_text}</p>
                {Array.isArray(item.evidence) && item.evidence.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] text-gray-400 font-medium">{t('drillDown.evidence')}</div>
                    {item.evidence.map((ev, i) => {
                      const audioKey = `drill-${item.id}-${i}`;
                      return (
                        <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-2">
                          {ev.tableId && (
                            <span className="text-[10px] font-medium text-gray-500 bg-white px-1.5 py-0.5 rounded">
                              {ev.tableId}
                            </span>
                          )}
                          <p className="text-xs text-gray-700 flex-1">
                            {ev.feedback ? `"${ev.feedback}"` : '--'}
                          </p>
                          {ev.audioUrl && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onAudioToggle(audioKey, ev.audioUrl!); }}
                              className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${
                                playingKey === audioKey
                                  ? 'bg-primary-100 text-primary-600'
                                  : 'bg-white text-gray-500 hover:text-primary-600'
                              }`}
                            >
                              {playingKey === audioKey ? (
                                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                              ) : (
                                <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
