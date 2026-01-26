// Recorder Page - Store manager records table visits with local-first approach
// v2.1 - Added: Auto-retry pending records from database on page load

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useRecordingStore } from '@/hooks/useRecordingStore';
import { TableSelector } from '@/components/recorder/TableSelector';
import { WaveformVisualizer } from '@/components/recorder/WaveformVisualizer';
import { RecordButton } from '@/components/recorder/RecordButton';
import { RecordingHistory } from '@/components/recorder/RecordingHistory';
import { processRecordingInBackground, retryPendingFromDatabase } from '@/lib/backgroundProcessor';

// Format seconds to MM:SS
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function RecorderPage() {
  const [tableId, setTableId] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [pendingSave, setPendingSave] = useState(false);

  const [recorderState, recorderActions] = useAudioRecorder();
  const { isRecording, duration, audioBlob, error, analyserData } = recorderState;
  const { startRecording, stopRecording, resetRecording } = recorderActions;

  const {
    recordings,
    saveRecording,
    updateRecording,
    getTodayRecordings,
    deleteRecording,
  } = useRecordingStore();

  const todayRecordings = getTodayRecordings();

  // Auto-retry pending records from database on page load
  // This recovers recordings that were interrupted by page refresh
  useEffect(() => {
    const retryPending = async () => {
      const { processed } = await retryPendingFromDatabase((message) => {
        showToast(message, 'info');
      });
      if (processed > 0) {
        showToast(`已恢复处理 ${processed} 条录音`, 'success');
      }
    };
    retryPending();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Show toast message
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Handle recording start
  const handleStart = useCallback(async () => {
    if (!tableId) {
      showToast('请先选择桌号', 'error');
      return;
    }
    await startRecording();
  }, [tableId, startRecording, showToast]);

  // Handle recording stop
  const handleStop = useCallback(async () => {
    stopRecording();
    setPendingSave(true);
  }, [stopRecording]);

  // When audioBlob is ready after stopping, save and process
  useEffect(() => {
    if (audioBlob && !isRecording && tableId && pendingSave) {
      setPendingSave(false);

      const processAsync = async () => {
        // Step 1: Save locally immediately
        const recording = await saveRecording(tableId, duration, audioBlob);
        showToast(`${tableId} 桌录音已保存`, 'success');

        // Step 2: Reset for next recording
        const savedTableId = tableId;
        resetRecording();
        setTableId('');

        // Step 3: Process in background (silent)
        processRecordingInBackground(recording, {
          onStatusChange: (id, status, data) => {
            updateRecording(id, { status, ...data });
            // Show completion toast
            if (status === 'completed') {
              showToast(`${savedTableId} 桌分析完成`, 'success');
            }
          },
          onError: (id, errorMsg) => {
            console.error(`Recording ${id} failed:`, errorMsg);
          },
        });
      };

      processAsync();
    }
  }, [audioBlob, isRecording, tableId, duration, pendingSave, saveRecording, resetRecording, updateRecording, showToast]);

  // Retry failed recording
  const handleRetry = useCallback((id: string) => {
    const recording = recordings.find(r => r.id === id);
    if (recording) {
      showToast('正在重试...', 'info');
      processRecordingInBackground(recording, {
        onStatusChange: (recId, status, data) => {
          updateRecording(recId, { status, ...data });
          if (status === 'completed') {
            showToast('重试成功', 'success');
          }
        },
        onError: (recId, errorMsg) => {
          showToast('重试失败', 'error');
          console.error(`Recording ${recId} retry failed:`, errorMsg);
        },
      });
    }
  }, [recordings, updateRecording, showToast]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">桌访录音</h1>
        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
          <span className="text-primary-600 text-xs font-medium">店</span>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Toast */}
        {toast && (
          <div
            className={`fixed top-16 left-4 right-4 p-3 rounded-xl text-center text-sm font-medium z-50 transition-all ${
              toast.type === 'success'
                ? 'bg-green-100 text-green-700'
                : toast.type === 'error'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-blue-100 text-blue-700'
            }`}
          >
            {toast.message}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Waveform Visualizer */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <WaveformVisualizer
            analyserData={analyserData}
            isRecording={isRecording}
          />
          <p className="text-center text-2xl font-mono text-gray-700 mt-4">
            {formatDuration(duration)}
          </p>
        </div>

        {/* Table Selector */}
        <TableSelector
          value={tableId}
          onChange={setTableId}
          disabled={isRecording}
        />

        {/* Record Button */}
        <div className="flex justify-center py-2">
          <RecordButton
            isRecording={isRecording}
            disabled={false}
            onStart={handleStart}
            onStop={handleStop}
          />
        </div>

        {/* Recording History */}
        <RecordingHistory
          recordings={todayRecordings}
          onRetry={handleRetry}
          onDelete={deleteRecording}
        />
      </main>
    </div>
  );
}
