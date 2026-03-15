// GuidedReviewFlow - Wizard container for guided daily review meeting
// v2.0 - Merged steps 1/2/3 into single "briefing" page, 4-step flow

'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { ArrowLeft, X } from 'lucide-react';
import { getCacheConfig } from '@/contexts/SWRProvider';
import { ReviewStep, REVIEW_STEPS, VISIBLE_STEPS, STEP_LABELS, DailySummaryData, ActionItemData } from './types';
import { ReviewStepBriefing } from './ReviewStepBriefing';
import { ReviewStepRecording } from './ReviewStepRecording';
import { ReviewStepProcessing } from './ReviewStepProcessing';
import { ReviewStepConfirmActions } from './ReviewStepConfirmActions';
import { ReviewStepComplete } from './ReviewStepComplete';
import type { MeetingRecord } from '@/hooks/useMeetingStore';
import type { AudioRecorderState, AudioRecorderActions } from '@/hooks/useAudioRecorder';

interface GuidedReviewFlowProps {
  restaurantId: string | undefined;
  recorderState: AudioRecorderState;
  recorderActions: AudioRecorderActions;
  onSaveMeeting: (duration: number, audioBlob: Blob) => Promise<MeetingRecord>;
  onProcessMeeting: (meeting: MeetingRecord) => void;
  onExit: () => void;
  meetings: MeetingRecord[];
}

export function GuidedReviewFlow({
  restaurantId,
  recorderState,
  recorderActions,
  onSaveMeeting,
  onProcessMeeting,
  onExit,
  meetings,
}: GuidedReviewFlowProps) {
  const [currentStep, setCurrentStep] = useState<ReviewStep>('briefing');
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [completedPendingCount, setCompletedPendingCount] = useState(0);
  const [confirmedActionCount, setConfirmedActionCount] = useState(0);
  const [meetingDuration, setMeetingDuration] = useState(0);

  // Fetch daily summary (for briefing + recording reference) — static during review session
  const { data: summaryData, isLoading: summaryLoading } = useSWR<{ summary: DailySummaryData }>(
    restaurantId ? `/api/daily-summary?restaurant_id=${restaurantId}` : null,
    { ...getCacheConfig('static') },
  );
  const summary = summaryData?.summary ?? null;

  // Fetch pending action items (for briefing) — static during review session
  const { data: pendingData, isLoading: pendingLoading } = useSWR<{ actions: ActionItemData[] }>(
    restaurantId ? `/api/action-items/pending?restaurant_id=${restaurantId}&limit=20` : null,
    { ...getCacheConfig('static') },
  );
  const pendingActions = pendingData?.actions ?? [];

  // Track the meeting being processed
  const currentMeeting = useMemo(() => {
    if (!meetingId) return null;
    return meetings.find(m => m.id === meetingId) ?? null;
  }, [meetingId, meetings]);

  // Auto-advance from processing to confirm when done
  useEffect(() => {
    if (currentStep === 'processing' && currentMeeting) {
      if (currentMeeting.status === 'processed' || currentMeeting.status === 'completed') {
        setCurrentStep('confirm-actions');
      }
    }
  }, [currentStep, currentMeeting]);

  // Handle recording complete → save and start processing
  const handleRecordingComplete = useCallback(async (duration: number, audioBlob: Blob) => {
    setMeetingDuration(duration);
    const meeting = await onSaveMeeting(duration, audioBlob);
    setMeetingId(meeting.id);
    onProcessMeeting(meeting);
    setCurrentStep('processing');
  }, [onSaveMeeting, onProcessMeeting]);

  // Handle retry from processing error
  const handleRetryProcessing = useCallback(() => {
    if (currentMeeting) {
      onProcessMeeting(currentMeeting);
    }
  }, [currentMeeting, onProcessMeeting]);

  // Handle skip processing → go to confirm with empty items (user adds manually)
  const handleSkipToConfirm = useCallback(() => {
    setCurrentStep('confirm-actions');
  }, []);

  // Progress bar index (processing is transitional, maps to confirm-actions position)
  const visibleIdx = VISIBLE_STEPS.indexOf(currentStep);
  const displayIdx = currentStep === 'processing'
    ? VISIBLE_STEPS.indexOf('confirm-actions')
    : visibleIdx;

  // Can go back? Only from briefing there's nowhere to go; from recording can go back to briefing
  const canGoBack = currentStep === 'recording' && !recorderState.isRecording;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header with progress */}
      <header className="island-header glass-nav px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {canGoBack && (
              <button
                onClick={() => setCurrentStep('briefing')}
                className="p-1 -ml-1 text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-base font-semibold text-gray-900">每日复盘</h1>
          </div>
          {/* X button — not during recording or processing */}
          {currentStep !== 'recording' && currentStep !== 'processing' && (
            <button onClick={onExit} className="p-1 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* 4-segment progress bar */}
        <div className="flex items-center gap-1">
          {VISIBLE_STEPS.map((_, idx) => (
            <div
              key={idx}
              className={`flex-1 h-1 rounded-full transition-colors duration-300 ${
                idx < displayIdx ? 'bg-primary-500' :
                idx === displayIdx ? 'bg-primary-400' :
                'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs text-gray-400">
            {STEP_LABELS[currentStep]}
          </span>
          <span className="text-xs text-gray-400">
            {displayIdx + 1}/{VISIBLE_STEPS.length}
          </span>
        </div>
      </header>

      {/* Step content */}
      <main className="flex-1 px-4 py-4 pt-[108px] island-page-bottom">
        {currentStep === 'briefing' && (
          <ReviewStepBriefing
            summary={summary}
            summaryLoading={summaryLoading}
            pendingActions={pendingActions}
            pendingLoading={pendingLoading}
            restaurantId={restaurantId}
            onCompletedCountChange={setCompletedPendingCount}
            onStartRecording={() => setCurrentStep('recording')}
          />
        )}

        {currentStep === 'recording' && (
          <ReviewStepRecording
            agendaItems={summary?.agenda_items ?? []}
            recorderState={recorderState}
            recorderActions={recorderActions}
            onRecordingComplete={handleRecordingComplete}
          />
        )}

        {currentStep === 'processing' && (
          <ReviewStepProcessing
            meeting={currentMeeting}
            onRetry={handleRetryProcessing}
            onSkip={handleSkipToConfirm}
          />
        )}

        {currentStep === 'confirm-actions' && (
          <ReviewStepConfirmActions
            meeting={currentMeeting}
            restaurantId={restaurantId}
            onConfirmed={(count) => {
              setConfirmedActionCount(count);
              setCurrentStep('complete');
            }}
          />
        )}

        {currentStep === 'complete' && (
          <ReviewStepComplete
            meetingDuration={meetingDuration}
            completedPendingCount={completedPendingCount}
            confirmedActionCount={confirmedActionCount}
            meetingId={meetingId}
            onExit={onExit}
          />
        )}
      </main>
    </div>
  );
}
