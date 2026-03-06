// Customer Insights Component - Brand-grouped flat issue layout
// v3.0.0 - Issues directly visible, grouped by brand, click to expand evidence

'use client';

import { useState, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { Lightbulb } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { QAConversation, AudioButton, ChevronDown, useAudioPlayback } from '@/components/shared/FeedbackWidgets';

// --- Types ---
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

interface SuggestionByRestaurant {
  restaurant_id: string;
  restaurant_name: string;
  brand_id: number | null;
  brand_name: string | null;
  suggestions: SuggestionItem[];
}

interface SuggestionsResponse {
  suggestions: SuggestionItem[];
  by_restaurant?: SuggestionByRestaurant[];
}

interface FeedbackContext {
  text: string;
  visitId: string;
  tableId: string;
  managerQuestions: string[];
  customerAnswers: string[];
  transcript: string;
  audioUrl: string | null;
}

interface FeedbackItem {
  text: string;
  count: number;
  contexts: FeedbackContext[];
}

interface ByRestaurantItem {
  restaurant_id: string;
  restaurant_name: string;
  brand_id: number | null;
  brand_name: string | null;
  positive_count: number;
  negative_count: number;
  positive_feedbacks: FeedbackItem[];
  negative_feedbacks: FeedbackItem[];
}

interface SentimentSummaryResponse {
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  total_feedbacks: number;
  positive_feedbacks: FeedbackItem[];
  negative_feedbacks: FeedbackItem[];
  by_restaurant?: ByRestaurantItem[];
}

// --- Brand-grouped view types ---
interface StoreRef {
  restaurant_id: string;
  restaurant_name: string;
}

interface BrandFeedbackItem {
  text: string;
  total_count: number;
  stores: (StoreRef & { contexts: FeedbackContext[] })[];
}

interface BrandSuggestionItem {
  text: string;
  total_count: number;
  stores: (StoreRef & { evidence: SuggestionEvidence[] })[];
}

interface BrandFeedbackGroup {
  brand_id: number | null;
  brand_name: string;
  negatives: BrandFeedbackItem[];
  suggestions: BrandSuggestionItem[];
  positives: BrandFeedbackItem[];
}

interface CustomerInsightsProps {
  startDate: string;
  endDate: string;
  managedIdsParam?: string;
}

export function CustomerInsights({ startDate, endDate, managedIdsParam = '' }: CustomerInsightsProps) {
  const { t } = useT();
  const { playingKey, handleAudioToggle } = useAudioPlayback();

  // Fetch suggestions — synced with date selector
  const { data: suggestionsData, isLoading: sugLoading } = useSWR<SuggestionsResponse>(
    `/api/dashboard/suggestions?restaurant_id=all&start_date=${startDate}&end_date=${endDate}${managedIdsParam}`
  );

  // Fetch sentiment summary for feedback hot words
  const { data: sentimentData, isLoading: sentLoading } = useSWR<SentimentSummaryResponse>(
    `/api/dashboard/sentiment-summary?restaurant_id=all&start_date=${startDate}&end_date=${endDate}${managedIdsParam}`
  );

  const isLoading = sugLoading || sentLoading;

  // Build brand-grouped data from both APIs
  const brandGroups = useMemo((): BrandFeedbackGroup[] => {
    // Step 1: Merge store-level data from both APIs
    interface MergedStore {
      restaurant_id: string;
      restaurant_name: string;
      brand_id: number | null;
      brand_name: string | null;
      suggestions: SuggestionItem[];
      negative_feedbacks: FeedbackItem[];
      positive_feedbacks: FeedbackItem[];
    }

    const storeMap = new Map<string, MergedStore>();

    for (const sr of suggestionsData?.by_restaurant ?? []) {
      storeMap.set(sr.restaurant_id, {
        restaurant_id: sr.restaurant_id,
        restaurant_name: sr.restaurant_name,
        brand_id: sr.brand_id ?? null,
        brand_name: sr.brand_name ?? null,
        suggestions: sr.suggestions ?? [],
        negative_feedbacks: [],
        positive_feedbacks: [],
      });
    }

    for (const sr of sentimentData?.by_restaurant ?? []) {
      const existing = storeMap.get(sr.restaurant_id);
      if (existing) {
        existing.negative_feedbacks = sr.negative_feedbacks ?? [];
        existing.positive_feedbacks = sr.positive_feedbacks ?? [];
        if (!existing.brand_id && sr.brand_id) {
          existing.brand_id = sr.brand_id;
          existing.brand_name = sr.brand_name;
        }
      } else {
        storeMap.set(sr.restaurant_id, {
          restaurant_id: sr.restaurant_id,
          restaurant_name: sr.restaurant_name,
          brand_id: sr.brand_id ?? null,
          brand_name: sr.brand_name ?? null,
          suggestions: [],
          negative_feedbacks: sr.negative_feedbacks ?? [],
          positive_feedbacks: sr.positive_feedbacks ?? [],
        });
      }
    }

    const stores = Array.from(storeMap.values());

    // Step 2: Aggregate issues across stores, grouped by brand
    const brandMap = new Map<string, {
      brand_id: number | null;
      brand_name: string;
      negMap: Map<string, BrandFeedbackItem>;
      sugMap: Map<string, BrandSuggestionItem>;
      posMap: Map<string, BrandFeedbackItem>;
      totalNeg: number;
    }>();

    for (const store of stores) {
      const bKey = store.brand_id != null ? String(store.brand_id) : '__none__';
      if (!brandMap.has(bKey)) {
        brandMap.set(bKey, {
          brand_id: store.brand_id,
          brand_name: store.brand_name || '',
          negMap: new Map(),
          sugMap: new Map(),
          posMap: new Map(),
          totalNeg: 0,
        });
      }
      const brand = brandMap.get(bKey)!;
      const storeRef: StoreRef = { restaurant_id: store.restaurant_id, restaurant_name: store.restaurant_name };

      // Negatives
      for (const fb of store.negative_feedbacks) {
        const existing = brand.negMap.get(fb.text);
        if (existing) {
          existing.total_count += fb.count;
          existing.stores.push({ ...storeRef, contexts: fb.contexts ?? [] });
        } else {
          brand.negMap.set(fb.text, {
            text: fb.text,
            total_count: fb.count,
            stores: [{ ...storeRef, contexts: fb.contexts ?? [] }],
          });
        }
        brand.totalNeg += fb.count;
      }

      // Suggestions
      for (const sug of store.suggestions) {
        const existing = brand.sugMap.get(sug.text);
        if (existing) {
          existing.total_count += sug.count;
          existing.stores.push({ ...storeRef, evidence: sug.evidence ?? [] });
        } else {
          brand.sugMap.set(sug.text, {
            text: sug.text,
            total_count: sug.count,
            stores: [{ ...storeRef, evidence: sug.evidence ?? [] }],
          });
        }
      }

      // Positives
      for (const fb of store.positive_feedbacks) {
        const existing = brand.posMap.get(fb.text);
        if (existing) {
          existing.total_count += fb.count;
          existing.stores.push({ ...storeRef, contexts: fb.contexts ?? [] });
        } else {
          brand.posMap.set(fb.text, {
            text: fb.text,
            total_count: fb.count,
            stores: [{ ...storeRef, contexts: fb.contexts ?? [] }],
          });
        }
      }
    }

    // Step 3: Convert to sorted arrays
    const sortByCount = <T extends { total_count: number }>(arr: T[]) =>
      arr.sort((a, b) => b.total_count - a.total_count);

    return Array.from(brandMap.values())
      .map(b => ({
        brand_id: b.brand_id,
        brand_name: b.brand_name,
        negatives: sortByCount(Array.from(b.negMap.values())),
        suggestions: sortByCount(Array.from(b.sugMap.values())),
        positives: sortByCount(Array.from(b.posMap.values())),
        totalNeg: b.totalNeg,
      }))
      .filter(b => b.negatives.length > 0 || b.suggestions.length > 0 || b.positives.length > 0)
      .sort((a, b) => b.totalNeg - a.totalNeg)
      .map(({ totalNeg: _, ...rest }) => rest);
  }, [suggestionsData, sentimentData]);

  const isMultiBrand = brandGroups.length > 1 || (brandGroups.length === 1 && brandGroups[0].brand_name !== '');

  // Single expand state for issue detail rows
  const [expandedDetail, setExpandedDetail] = useState<string | null>(null);
  const toggleDetail = useCallback((key: string) => {
    setExpandedDetail(prev => prev === key ? null : key);
  }, []);

  // Store name list for an issue row
  const storeNames = (stores: StoreRef[]) =>
    stores.map(s => s.restaurant_name).join(' · ');

  return (
    <div className="space-y-3">
      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-full mb-2" />
              <div className="h-3 bg-gray-100 rounded w-4/5" />
            </div>
          ))}
        </div>
      )}

      {/* Brand-grouped flat issue list */}
      {brandGroups.map((brand) => {
        const brandKey = brand.brand_id != null ? String(brand.brand_id) : '__none__';

        return (
          <div key={brandKey}>
            {/* Brand title (only when multi-brand) */}
            {isMultiBrand && brand.brand_name && (
              <div className="flex items-center gap-3 px-1 pt-2 pb-1.5">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs font-semibold text-gray-500 tracking-wide uppercase">{brand.brand_name}</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
            )}

            <div className="glass-card rounded-2xl overflow-hidden">
              {/* Needs attention (negatives) */}
              {brand.negatives.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-xs text-amber-500 font-medium">{t('insights.needsAttention')}</span>
                  </div>
                  {brand.negatives.map((item, idx) => {
                    const itemKey = `${brandKey}-neg-${idx}`;
                    const isExp = expandedDetail === itemKey;
                    const hasEvidence = item.stores.some(s => s.contexts.length > 0);
                    return (
                      <div key={itemKey} className={`transition-colors ${isExp ? 'bg-gray-50' : ''}`}>
                        <div
                          className={`flex items-start gap-2.5 px-4 py-2.5 ${hasEvidence ? 'cursor-pointer active:bg-gray-50' : ''}`}
                          onClick={() => hasEvidence && toggleDetail(itemKey)}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-1.5" />
                          <span className="text-sm text-gray-800 flex-1 leading-relaxed">&ldquo;{item.text}&rdquo;</span>
                          <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                            <span className="text-xs text-gray-400 max-w-[120px] truncate">{storeNames(item.stores)}</span>
                            {hasEvidence && <ChevronDown expanded={isExp} />}
                          </div>
                        </div>
                        {isExp && renderStoreEvidence(item.stores.map(s => ({ ...s, items: s.contexts })), itemKey, t, playingKey, handleAudioToggle)}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Suggestions */}
              {brand.suggestions.length > 0 && (
                <>
                  {brand.negatives.length > 0 && <div className="mx-4 border-t border-gray-100" />}
                  <div>
                    <div className="px-4 pt-3 pb-1">
                      <span className="text-xs text-purple-500 font-medium">{t('insights.suggestion')}</span>
                    </div>
                    {brand.suggestions.map((item, idx) => {
                      const itemKey = `${brandKey}-sug-${idx}`;
                      const isExp = expandedDetail === itemKey;
                      const hasEvidence = item.stores.some(s => s.evidence.length > 0);
                      return (
                        <div key={itemKey} className={`transition-colors ${isExp ? 'bg-gray-50' : ''}`}>
                          <div
                            className={`flex items-start gap-2.5 px-4 py-2.5 ${hasEvidence ? 'cursor-pointer active:bg-gray-50' : ''}`}
                            onClick={() => hasEvidence && toggleDetail(itemKey)}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0 mt-1.5" />
                            <span className="text-sm text-gray-800 flex-1 leading-relaxed">{item.text}</span>
                            <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                              <span className="text-xs text-gray-400 max-w-[120px] truncate">{storeNames(item.stores)}</span>
                              {hasEvidence && <ChevronDown expanded={isExp} />}
                            </div>
                          </div>
                          {isExp && renderStoreEvidence(item.stores.map(s => ({ ...s, items: s.evidence })), itemKey, t, playingKey, handleAudioToggle)}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Positives */}
              {brand.positives.length > 0 && (
                <>
                  {(brand.negatives.length > 0 || brand.suggestions.length > 0) && <div className="mx-4 border-t border-gray-100" />}
                  <div>
                    <div className="px-4 pt-3 pb-1">
                      <span className="text-xs text-green-500 font-medium">{t('insights.satisfied')}</span>
                    </div>
                    {brand.positives.map((item, idx) => {
                      const itemKey = `${brandKey}-pos-${idx}`;
                      const isExp = expandedDetail === itemKey;
                      const hasEvidence = item.stores.some(s => s.contexts.length > 0);
                      return (
                        <div key={itemKey} className={`transition-colors ${isExp ? 'bg-gray-50' : ''}`}>
                          <div
                            className={`flex items-start gap-2.5 px-4 py-2.5 ${hasEvidence ? 'cursor-pointer active:bg-gray-50' : ''}`}
                            onClick={() => hasEvidence && toggleDetail(itemKey)}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0 mt-1.5" />
                            <span className="text-sm text-gray-800 flex-1 leading-relaxed">&ldquo;{item.text}&rdquo;</span>
                            <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                              <span className="text-xs text-gray-400 max-w-[120px] truncate">{storeNames(item.stores)}</span>
                              {hasEvidence && <ChevronDown expanded={isExp} />}
                            </div>
                          </div>
                          {isExp && renderStoreEvidence(item.stores.map(s => ({ ...s, items: s.contexts })), itemKey, t, playingKey, handleAudioToggle)}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="h-2" />
            </div>
          </div>
        );
      })}

      {/* Empty state */}
      {!isLoading && brandGroups.length === 0 && (
        <div className="glass-card rounded-xl p-8 text-center">
          <div className="flex justify-center mb-3"><Lightbulb className="w-10 h-10 text-gray-300" /></div>
          <h3 className="text-base font-medium text-gray-700 mb-1">{t('insights.emptyTitle')}</h3>
          <p className="text-sm text-gray-400">
            {t('insights.emptyCustomer')}
          </p>
        </div>
      )}
    </div>
  );
}

// --- Evidence renderer (unified for both feedback contexts and suggestion evidence) ---

interface EvidenceItem {
  tableId: string;
  audioUrl: string | null;
  managerQuestions?: string[];
  customerAnswers?: string[];
}

function renderStoreEvidence(
  stores: (StoreRef & { items: EvidenceItem[] })[],
  parentKey: string,
  t: (key: string, ...args: (string | number)[]) => string,
  playingKey: string | null,
  handleAudioToggle: (key: string, url: string) => void,
) {
  return (
    <div className="px-4 pb-3 space-y-3">
      {stores.map((store, si) => {
        if (store.items.length === 0) return null;
        return (
          <div key={si}>
            <span className="inline-block text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded mb-1.5">
              {store.restaurant_name}
            </span>
            <div className="space-y-2">
              {store.items.slice(0, 3).map((item, ci) => {
                const audioKey = `${parentKey}-s${si}-${ci}`;
                return (
                  <div key={ci} className="bg-white rounded-xl p-3 border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        {t('insights.table', item.tableId)}
                      </span>
                      {item.audioUrl && (
                        <AudioButton audioKey={audioKey} audioUrl={item.audioUrl} playingKey={playingKey} onToggle={handleAudioToggle} />
                      )}
                    </div>
                    <div className="border-l-2 border-primary-200 pl-3">
                      <QAConversation questions={item.managerQuestions ?? []} answers={item.customerAnswers ?? []} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
