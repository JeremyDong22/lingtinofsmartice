// Recording Store - Local-first storage with background sync
// v1.0 - Manages recordings in localStorage with status tracking

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

// Helper: Save recordings to localStorage
function saveRecordings(recordings: Recording[]) {
  if (typeof window === 'undefined') return;
  // Keep only recent recordings to manage storage
  const trimmed = recordings.slice(0, MAX_LOCAL_RECORDINGS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
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

  return {
    recordings,
    isLoading,
    saveRecording,
    updateRecording,
    getTodayRecordings,
    deleteRecording,
    cleanupAudioData,
  };
}
