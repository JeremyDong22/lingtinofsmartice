// Recording Store - Local-first storage with background sync
// v1.2 - Added: getRecordingsNeedingRetry for upload recovery on page reload

import { useState, useEffect, useCallback } from 'react';

export type RecordingStatus =
  | 'saved'        // Saved to localStorage
  | 'uploading'    // Uploading to cloud storage
  | 'processing'   // AI pipeline running
  | 'completed'    // Fully processed
  | 'error';       // Processing failed

export interface Recording {
  id: string;
  tableId: string;
  duration: number;
  timestamp: number;
  status: RecordingStatus;
  audioData?: string;        // Base64 encoded audio (localStorage)
  audioUrl?: string;         // Cloud storage URL (after upload)
  transcript?: string;       // Raw STT result
  correctedTranscript?: string;
  aiSummary?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  sentimentScore?: number;
  errorMessage?: string;
}

const STORAGE_KEY = 'lingtin_recordings';
const MAX_LOCAL_RECORDINGS = 20;

// Helper: Get recordings from localStorage
function getStoredRecordings(): Recording[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Helper: Save recordings to localStorage with quota handling
function saveRecordings(recordings: Recording[]): { success: boolean; error?: string } {
  if (typeof window === 'undefined') return { success: true };

  // Keep only recent recordings to manage storage
  let trimmed = recordings.slice(0, MAX_LOCAL_RECORDINGS);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    return { success: true };
  } catch (error) {
    // Handle quota exceeded error
    if (error instanceof DOMException && (
      error.code === 22 || // Legacy quota exceeded
      error.code === 1014 || // Firefox quota exceeded
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    )) {
      console.warn('[RecordingStore] localStorage quota exceeded, cleaning up old data');

      // Strategy 1: Remove audioData from completed recordings
      trimmed = trimmed.map(rec =>
        rec.status === 'completed' && rec.audioUrl
          ? { ...rec, audioData: undefined }
          : rec
      );

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        return { success: true };
      } catch {
        // Strategy 2: Keep only the most recent 5 recordings
        console.warn('[RecordingStore] Still over quota, keeping only 5 recent recordings');
        trimmed = trimmed.slice(0, 5);

        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
          return { success: true };
        } catch {
          // Strategy 3: Clear all and save only the newest
          console.error('[RecordingStore] Critical: clearing all recordings');
          localStorage.removeItem(STORAGE_KEY);
          return { success: false, error: '存储空间不足，已清理旧录音' };
        }
      }
    }

    console.error('[RecordingStore] Failed to save:', error);
    return { success: false, error: '保存失败' };
  }
}

// Helper: Convert Blob to Base64
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function useRecordingStore() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load recordings from localStorage on mount
  useEffect(() => {
    setRecordings(getStoredRecordings());
    setIsLoading(false);
  }, []);

  // Save a new recording (local first)
  const saveRecording = useCallback(async (
    tableId: string,
    duration: number,
    audioBlob: Blob
  ): Promise<Recording> => {
    const audioData = await blobToBase64(audioBlob);

    const newRecording: Recording = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tableId,
      duration,
      timestamp: Date.now(),
      status: 'saved',
      audioData,
    };

    setRecordings(prev => {
      const updated = [newRecording, ...prev];
      saveRecordings(updated);
      return updated;
    });

    return newRecording;
  }, []);

  // Update recording status
  const updateRecording = useCallback((
    id: string,
    updates: Partial<Recording>
  ) => {
    setRecordings(prev => {
      const updated = prev.map(rec =>
        rec.id === id ? { ...rec, ...updates } : rec
      );
      saveRecordings(updated);
      return updated;
    });
  }, []);

  // Get today's recordings
  const getTodayRecordings = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return recordings.filter(rec => rec.timestamp >= today.getTime());
  }, [recordings]);

  // Delete a recording
  const deleteRecording = useCallback((id: string) => {
    setRecordings(prev => {
      const updated = prev.filter(rec => rec.id !== id);
      saveRecordings(updated);
      return updated;
    });
  }, []);

  // Clear audio data from completed recordings (save space)
  const cleanupAudioData = useCallback(() => {
    setRecordings(prev => {
      const updated = prev.map(rec =>
        rec.status === 'completed' && rec.audioUrl
          ? { ...rec, audioData: undefined }
          : rec
      );
      saveRecordings(updated);
      return updated;
    });
  }, []);

  // Get recordings that need retry (uploading or saved with audioData)
  // These are recordings that were interrupted during upload
  const getRecordingsNeedingRetry = useCallback(() => {
    return recordings.filter(rec =>
      (rec.status === 'uploading' || rec.status === 'saved') && rec.audioData
    );
  }, [recordings]);

  return {
    recordings,
    isLoading,
    saveRecording,
    updateRecording,
    getTodayRecordings,
    deleteRecording,
    cleanupAudioData,
    getRecordingsNeedingRetry,
  };
}
