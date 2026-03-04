// Admin Meetings Page - Cross-store meeting overview + my meetings
// Default shows yesterday's data, with date picker

'use client';

import { useState, useMemo } from 'react';
import { ClipboardList } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { useManagedScope } from '@/hooks/useManagedScope';
import { useT, getLocale } from '@/lib/i18n';
import { UserMenu } from '@/components/layout/UserMenu';
import { MeetingDetail } from '@/components/recorder/MeetingDetail';
import { DatePicker, useAdminPresets } from '@/components/shared/DatePicker';
import { getChinaYesterday, singleDay, dateRangeParams } from '@/lib/date-utils';
import type { DateRange } from '@/lib/date-utils';
import type { MeetingRecord, MeetingType, MeetingStatus } from '@/hooks/useMeetingStore';

// --- Types ---
interface ApiMeeting {
  id: string;
  meeting_type: string;
  duration_seconds: number | null;
  ai_summary: string | null;
  action_items: Array<{ who: string; what: string; deadline: string }> | null;
  key_decisions: Array<{ decision: string; context: string }> | null;
  status: string;
  audio_url: string | null;
  created_at: string;
}

interface StoreOverview {
  id: string;
  name: string;
  meetings: ApiMeeting[];
  last_meeting_date: string | null;
}

interface AdminOverviewResponse {
  date: string;
  summary: {
    total_meetings: number;
    stores_with_meetings: number;
    stores_without: number;
  };
  stores: StoreOverview[];
  my_meetings: ApiMeeting[];
}

const MEETING_TYPE_COLORS: Record<string, string> = {
  pre_meal: 'bg-primary-100 text-primary-700',
  daily_review: 'bg-amber-100 text-amber-700',
  weekly: 'bg-purple-100 text-purple-700',
  kitchen_meeting: 'bg-orange-100 text-orange-700',
  cross_store_review: 'bg-primary-100 text-primary-700',
  one_on_one: 'bg-teal-100 text-teal-700',
};

type TFunc = (key: string, ...args: (string | number)[]) => string;

function getMeetingTypeLabel(type: string, t: TFunc): { label: string; color: string } {
  const typeKeyMap: Record<string, string> = {
    pre_meal: 'meetings.type.pre_shift',
    daily_review: 'meetings.type.daily_review',
    weekly: 'meetings.type.weekly',
    kitchen_meeting: 'meetings.type.kitchen',
    cross_store_review: 'meetings.type.business',
    one_on_one: 'meetings.type.manager_sync',
  };
  const key = typeKeyMap[type];
  return {
    label: key ? t(key) : type,
    color: MEETING_TYPE_COLORS[type] || 'bg-gray-100 text-gray-700',
  };
}

function formatDateLabel(dateStr: string, locale: string = 'zh-CN'): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (locale === 'en') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatTime(isoStr: string, locale: string = 'zh-CN'): string {
  return new Date(isoStr).toLocaleTimeString(locale === 'en' ? 'en-US' : 'zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(seconds: number | null, t: TFunc): string {
  if (!seconds) return '';
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    return t('meetings.mins', mins);
  }
  return t('meetings.secs', seconds);
}

function apiToMeetingRecord(m: ApiMeeting): MeetingRecord {
  return {
    id: m.id,
    meetingType: m.meeting_type as MeetingType,
    duration: m.duration_seconds || 0,
    timestamp: new Date(m.created_at).getTime(),
    status: (m.status === 'processed' ? 'processed' : m.status) as MeetingStatus,
    audioUrl: m.audio_url || undefined,
    aiSummary: m.ai_summary || undefined,
    actionItems: m.action_items || undefined,
    keyDecisions: m.key_decisions || undefined,
  };
}

// --- Meeting Summary Row ---
function MeetingSummaryRow({
  meeting,
  onTap,
  t,
}: {
  meeting: ApiMeeting;
  onTap: () => void;
  t: TFunc;
}) {
  const typeInfo = getMeetingTypeLabel(meeting.meeting_type, t);
  const actionCount = meeting.action_items?.length || 0;
  const isProcessed = meeting.status === 'processed';

  return (
    <div
      className={`flex items-start gap-3 py-2.5 ${isProcessed ? 'cursor-pointer active:bg-gray-50' : ''}`}
      onClick={isProcessed ? onTap : undefined}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${typeInfo.color}`}>
            {typeInfo.label}
          </span>
          <span className="text-xs text-gray-400">
            {formatTime(meeting.created_at, getLocale())}
          </span>
          {meeting.duration_seconds && (
            <span className="text-xs text-gray-300">
              {formatDuration(meeting.duration_seconds, t)}
            </span>
          )}
        </div>
        {isProcessed && meeting.ai_summary && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-1">{meeting.ai_summary}</p>
        )}
        {meeting.status === 'processing' && (
          <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
            {t('meetings.analyzing')}
          </p>
        )}
        {meeting.status === 'error' && (
          <p className="text-xs text-red-500 mt-1">{t('meetings.failed')}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
        {isProcessed && actionCount > 0 && (
          <span className="text-[11px] text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">
            {t('meetings.actionCount', actionCount)}
          </span>
        )}
        {isProcessed && (
          <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        )}
      </div>
    </div>
  );
}

// --- Store Meeting Card ---
function StoreMeetingCard({
  store,
  expanded,
  onToggle,
  onMeetingTap,
  t,
}: {
  store: StoreOverview;
  expanded: boolean;
  onToggle: () => void;
  onMeetingTap: (m: ApiMeeting) => void;
  t: TFunc;
}) {
  const hasMeetings = store.meetings.length > 0;

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div
        className={`px-4 py-3 flex items-center justify-between ${hasMeetings ? 'cursor-pointer active:bg-gray-50' : ''}`}
        onClick={hasMeetings ? onToggle : undefined}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{store.name}</span>
          {hasMeetings && (
            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600">
              {store.meetings.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!hasMeetings && (
            <span className="text-xs text-gray-300">
              {store.last_meeting_date
                ? t('meetings.lastMeeting', formatDateLabel(store.last_meeting_date, getLocale()))
                : t('meetings.noMeeting')}
            </span>
          )}
          {hasMeetings && (
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </div>
      {hasMeetings && expanded && (
        <div className="px-4 divide-y divide-gray-50 border-t border-gray-50">
          {store.meetings.map((m) => (
            <MeetingSummaryRow key={m.id} meeting={m} onTap={() => onMeetingTap(m)} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminMeetingsPage() {
  const { user } = useAuth();
  const { managedIdsParam } = useManagedScope();
  const { t } = useT();
  const adminPresets = useAdminPresets();
  const [dateRange, setDateRange] = useState<DateRange>(() => singleDay(getChinaYesterday()));
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingRecord | null>(null);
  const [showMyMeetings, setShowMyMeetings] = useState(true);
  const [expandedStoreId, setExpandedStoreId] = useState<string | null>(null);

  const { data: apiData, isLoading, error } = useSWR<AdminOverviewResponse>(
    `/api/meeting/admin-overview?${dateRangeParams(dateRange)}${user?.id ? `&employee_id=${user.id}` : ''}${managedIdsParam}`
  );
  const data = apiData;
  const hasData = !!data;

  const storesWithMeetings = useMemo(
    () => (data?.stores || []).filter(s => s.meetings.length > 0),
    [data],
  );
  const storesWithout = useMemo(
    () => (data?.stores || []).filter(s => s.meetings.length === 0),
    [data],
  );

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="island-header glass-nav px-[1.125rem] py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">{t('meetings.title')}</h1>
        <div className="flex items-center gap-2">
          <DatePicker
            value={dateRange}
            onChange={setDateRange}
            maxDate={getChinaYesterday()}
            presets={adminPresets}
          />
          <Link
            href="/admin/meetings/record"
            className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {t('meetings.record')}
          </Link>
          <UserMenu />
        </div>
      </header>

      <div className="px-4 space-y-3 island-page-top island-page-bottom">
        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        )}

        {/* My Meetings */}
        {hasData && data.my_meetings.length > 0 && (
          <div className="bg-primary-50 rounded-2xl overflow-hidden">
            <div
              className="px-4 py-3 flex items-center justify-between cursor-pointer"
              onClick={() => setShowMyMeetings(!showMyMeetings)}
            >
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                <span className="text-sm font-semibold text-primary-800">
                  {t('meetings.myMeetings', data.my_meetings.length)}
                </span>
              </div>
              <svg
                className={`w-4 h-4 text-primary-400 transition-transform ${showMyMeetings ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {showMyMeetings && (
              <div className="px-4 pb-3 divide-y divide-primary-100">
                {data.my_meetings.map((m) => (
                  <MeetingSummaryRow
                    key={m.id}
                    meeting={m}
                    onTap={() => setSelectedMeeting(apiToMeetingRecord(m))}
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Summary stats */}
        {hasData && !isLoading && (
          <div className="text-xs text-gray-400 px-1">
            {t('meetings.storesSummary', data.stores.length, data.summary.total_meetings)}
            {data.summary.stores_without > 0 && (
              <> · <span className="text-amber-500">{t('meetings.storesWithout', data.summary.stores_without)}</span></>
            )}
          </div>
        )}

        {/* Stores with meetings */}
        {storesWithMeetings.map((store) => (
          <StoreMeetingCard
            key={store.id}
            store={store}
            expanded={expandedStoreId === store.id}
            onToggle={() => setExpandedStoreId(prev => prev === store.id ? null : store.id)}
            onMeetingTap={(m) => setSelectedMeeting(apiToMeetingRecord(m))}
            t={t}
          />
        ))}

        {/* Stores without meetings */}
        {storesWithout.length > 0 && (
          <div className="glass-card rounded-2xl p-4">
            <div className="text-sm font-medium text-gray-400 mb-2">
              {t('meetings.storesWithoutTitle', storesWithout.length)}
            </div>
            <div className="flex flex-wrap gap-2">
              {storesWithout.map((store) => (
                <span key={store.id} className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">
                  {store.name}
                  {store.last_meeting_date && (
                    <span className="text-gray-300 ml-1">
                      · {formatDateLabel(store.last_meeting_date, getLocale())}
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Empty state - show when API returned empty data OR when API failed (not yet deployed) */}
        {!isLoading && (
          (hasData && data.summary.total_meetings === 0 && data.my_meetings.length === 0) ||
          (!hasData && !isLoading)
        ) && (
          <div className="glass-card rounded-2xl p-8 text-center">
            <div className="flex justify-center mb-3"><ClipboardList className="w-10 h-10 text-gray-300" /></div>
            <h3 className="text-base font-medium text-gray-700 mb-1">{t('meetings.emptyTitle')}</h3>
            <p className="text-sm text-gray-400">
              {t('meetings.emptyBody')}
            </p>
          </div>
        )}
      </div>

      {/* Meeting Detail Bottom Sheet */}
      <MeetingDetail
        meeting={selectedMeeting}
        onClose={() => setSelectedMeeting(null)}
      />
    </div>
  );
}
