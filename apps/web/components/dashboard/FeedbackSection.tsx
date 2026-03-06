// FeedbackSection - Store manager dashboard feedback card
// Aligned with admin CustomerInsights visual style (inline expand, dots, quotes, chevron)

'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n';
import { QAConversation, AudioButton, ChevronDown, useAudioPlayback } from '@/components/shared/FeedbackWidgets';

interface FeedbackContext {
  text: string;
  visitId: string;
  tableId: string;
  managerQuestions: string[];
  customerAnswers: string[];
  transcript: string;
  audioUrl?: string | null;
}

interface FeedbackItem {
  text: string;
  count: number;
  contexts?: FeedbackContext[];
}

interface SuggestionEvidence {
  tableId: string;
  audioUrl: string | null;
  restaurantName: string;
  restaurantId: string;
  managerQuestions?: string[];
  customerAnswers?: string[];
}

interface SuggestionItem {
  text: string;
  count: number;
  restaurants: string[];
  evidence: SuggestionEvidence[];
}

interface FeedbackSectionProps {
  negativeFeedbacks: FeedbackItem[];
  positiveFeedbacks: FeedbackItem[];
  suggestions: SuggestionItem[];
  loading: boolean;
}

export function FeedbackSection({ negativeFeedbacks, positiveFeedbacks, suggestions, loading }: FeedbackSectionProps) {
  const { t } = useT();
  const [expandedDetail, setExpandedDetail] = useState<string | null>(null);
  const { playingKey, handleAudioToggle } = useAudioPlayback();

  const toggleDetail = (key: string) => setExpandedDetail(prev => prev === key ? null : key);

  const hasNeg = negativeFeedbacks.length > 0;
  const hasPos = positiveFeedbacks.length > 0;
  const hasSug = suggestions.length > 0;
  const hasAny = hasNeg || hasPos || hasSug;

  const renderFeedbackRow = (fb: FeedbackItem, type: 'neg' | 'pos', idx: number) => {
    const fbKey = `${type}-${idx}`;
    const isExp = expandedDetail === fbKey;
    const hasCtx = fb.contexts && fb.contexts.length > 0;
    const dotColor = type === 'neg' ? 'bg-amber-400' : 'bg-green-400';
    return (
      <div key={fbKey} className={`transition-colors ${isExp ? 'bg-gray-50' : ''}`}>
        <div
          className={`flex items-center gap-2.5 px-4 py-2.5 ${hasCtx ? 'cursor-pointer active:bg-gray-50' : ''}`}
          onClick={() => hasCtx && toggleDetail(fbKey)}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${dotColor} flex-shrink-0`} />
          <span className="text-sm text-gray-800 flex-1 leading-relaxed">&ldquo;{fb.text}&rdquo;</span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs text-gray-300">{t('dashboard.tables', fb.count)}</span>
            {hasCtx && <ChevronDown expanded={isExp} />}
          </div>
        </div>
        {isExp && hasCtx && (
          <div className="px-4 pb-3 space-y-2">
            {fb.contexts!.slice(0, 3).map((ctx, ci) => {
              const audioKey = `${fbKey}-${ci}`;
              return (
                <div key={ci} className="bg-white rounded-xl p-3 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                      {t('dashboard.tableId', ctx.tableId)}
                    </span>
                    {ctx.audioUrl && (
                      <AudioButton audioKey={audioKey} audioUrl={ctx.audioUrl} playingKey={playingKey} onToggle={handleAudioToggle} />
                    )}
                  </div>
                  <div className="border-l-2 border-primary-200 pl-3">
                    <QAConversation questions={ctx.managerQuestions ?? []} answers={ctx.customerAnswers ?? []} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderSuggestionRow = (item: SuggestionItem, idx: number) => {
    const sugKey = `sug-${idx}`;
    const isExp = expandedDetail === sugKey;
    const hasEvidence = item.evidence.length > 0;
    return (
      <div key={sugKey} className={`transition-colors ${isExp ? 'bg-gray-50' : ''}`}>
        <div
          className={`flex items-start gap-2.5 px-4 py-2.5 ${hasEvidence ? 'cursor-pointer active:bg-gray-50' : ''}`}
          onClick={() => hasEvidence && toggleDetail(sugKey)}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0 mt-1.5" />
          <span className="text-sm text-gray-800 flex-1 leading-relaxed">{item.text}</span>
          <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
            <span className="text-xs font-medium text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full">{item.count}</span>
            {hasEvidence && <ChevronDown expanded={isExp} />}
          </div>
        </div>
        {isExp && (
          <div className="px-4 pb-3 space-y-2">
            {item.evidence.map((ev, ei) => {
              const audioKey = `${sugKey}-${ei}`;
              return (
                <div key={ei} className="bg-white rounded-xl p-3 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                      {t('dashboard.tableId', ev.tableId)}
                    </span>
                    {ev.audioUrl && (
                      <AudioButton audioKey={audioKey} audioUrl={ev.audioUrl} playingKey={playingKey} onToggle={handleAudioToggle} />
                    )}
                  </div>
                  <div className="border-l-2 border-primary-200 pl-3">
                    <QAConversation questions={ev.managerQuestions ?? []} answers={ev.customerAnswers ?? []} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-sm font-medium text-gray-700">{t('dashboard.customerFeedback')}</h2>
      </div>

      {hasAny ? (
        <div>
          {/* Negative feedbacks */}
          {hasNeg && (
            <div>
              <div className="px-4 pt-2.5 pb-1">
                <span className="text-xs text-amber-500 font-medium">{t('insights.dissatisfied')}</span>
              </div>
              {negativeFeedbacks.map((fb, idx) => renderFeedbackRow(fb, 'neg', idx))}
            </div>
          )}

          {/* Positive feedbacks */}
          {hasPos && (
            <>
              {hasNeg && <div className="mx-4 border-t border-gray-100" />}
              <div>
                <div className="px-4 pt-2.5 pb-1">
                  <span className="text-xs text-green-500 font-medium">{t('insights.satisfied')}</span>
                </div>
                {positiveFeedbacks.map((fb, idx) => renderFeedbackRow(fb, 'pos', idx))}
              </div>
            </>
          )}

          {/* Suggestions */}
          {hasSug && (
            <>
              {(hasNeg || hasPos) && <div className="mx-4 border-t border-gray-100" />}
              <div>
                <div className="px-4 pt-2.5 pb-1">
                  <span className="text-xs text-purple-500 font-medium">{t('dashboard.suggestions')}</span>
                </div>
                {suggestions.map((item, idx) => renderSuggestionRow(item, idx))}
              </div>
            </>
          )}

          <div className="h-2" />
        </div>
      ) : !loading ? (
        <div className="text-center py-4 pb-6 text-gray-400">{t('dashboard.noFeedback')}</div>
      ) : null}
    </div>
  );
}
