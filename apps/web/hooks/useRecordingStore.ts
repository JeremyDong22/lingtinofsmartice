// Recording Store - Database as single source of truth
// v2.0 - Sync with database: fetch on load, delete calls API

import { useState, useEffect, useCallback } from 'react';
import { getAuthHeaders } from '@/contexts/AuthContext';

export type RecordingStatus =
  | 'saved'        // Saved to localStorage (not yet uploaded)
  | 'uploading'    // Uploading to cloud storage
  | 'pending'      // Uploaded, waiting for AI processing
  | 'processing'   // AI pipeline running
  | 'processed'    // Fully processed (database status)
  | 'completed'    // Alias for processed (frontend display)
  | 'error';       // Processing failed

export interface Recording {
  id: string;
  tableId: string;
  duration: number;
  timestamp: number;
  status: RecordingStatus;
  audioData?: string;        // Base64 encoded audio (localStorage only)
  audioUrl?: string;         // Cloud storage URL (after upload)
  transcript?: string;       // Raw STT result
  correctedTranscript?: string;
  aiSummary?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  sentimentScore?: number;
  errorMessage?: string;
}

const LOCAL_STORAGE_KEY = 'lingtin_recordings_local';
const MAX_LOCAL_RECORDINGS = 20;

// Helper: Get local-only recordings (not yet uploaded)
function getLocalRecordings(): Recording[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Helper: Save local-only recordings
function saveLocalRecordings(recordings: Recording[]): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = recordings.slice(0, MAX_LOCAL_RECORDINGS);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('[RecordingStore] Failed to save local recordings:', error);
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

// Convert database record to Recording format
function dbRecordToRecording(dbRecord: {
  id: string;
  table_id: string;
  status: string;
  ai_summary?: string;
  sentiment_score?: number;
  created_at: string;
}): Recording {
  return {
    id: dbRecord.id,
    tableId: dbRecord.table_id,
    duration: 0,
    timestamp: new Date(dbRecord.created_at).getTime(),
    status: dbRecord.status === 'processed' ? 'completed' : dbRecord.status as RecordingStatus,
    aiSummary: dbRecord.ai_summary,
    sentimentScore: dbRecord.sentiment_score,
  };
}

export function useRecordingStore(restaurantId?: string) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch today's recordings from database on mount
  useEffect(() => {
    const fetchFromDatabase = async () => {
      if (!restaurantId) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/audio/today?restaurant_id=${restaurantId}`, {
          headers: getAuthHeaders(),
        });

        if (response.ok) {
          const { records } = await response.json();
          const dbRecordings = records.map(dbRecordToRecording);

          // Merge with local recordings (not yet uploaded)
          const localRecs = getLocalRecordings();
          const localNotUploaded = localRecs.filter(
            r => r.status === 'saved' || r.status === 'uploading'
          );

          // Combine: local not-uploaded + database records
          setRecordings([...localNotUploaded, ...dbRecordings]);
        }
      } catch (error) {
        console.error('[RecordingStore] Failed to fetch from database:', error);
        // Fallback to local storage
        setRecordings(getLocalRecordings());
      } finally {
        setIsLoading(false);
      }
    };

    fetchFromDatabase();
  }, [restaurantId]);

  // Save a new recording (local first, before upload)
  const saveRecording = useCallback(async (
    tableId: string,
    duration: number,
    audioBlob: Blob
  ): Promise<Recording> => {
    const audioData = await blobToBase64(audioBlob);

    const newRecording: Recording = {
      id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      tableId,
      duration,
      timestamp: Date.now(),
      status: 'saved',
      audioData,
    };

    setRecordings(prev => {
      const updated = [newRecording, ...prev];
      // Save to local storage (only local recordings)
      const localRecs = updated.filter(r => r.status === 'saved' || r.status === 'uploading');
      saveLocalRecordings(localRecs);
      return updated;
    });

    return newRecording;
  }, []);

  // Update recording status (called during processing)
  const updateRecording = useCallback((
    id: string,
    updates: Partial<Recording>
  ) => {
    setRecordings(prev => {
      const updated = prev.map(rec =>
        rec.id === id ? { ...rec, ...updates } : rec
      );
      // Update local storage for local recordings
      const localRecs = updated.filter(r => r.status === 'saved' || r.status === 'uploading');
      saveLocalRecordings(localRecs);
      return updated;
    });
  }, []);

  // Get today's recordings
  const getTodayRecordings = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return recordings.filter(rec => rec.timestamp >= today.getTime());
  }, [recordings]);

  // Delete a recording (calls API to delete from database)
  const deleteRecording = useCallback(async (id: string) => {
    // Optimistically remove from UI
    setRecordings(prev => {
      const updated = prev.filter(rec => rec.id !== id);
      const localRecs = updated.filter(r => r.status === 'saved' || r.status === 'uploading');
      saveLocalRecordings(localRecs);
      return updated;
    });

    // Call API to delete from database (if it's a database record)
    try {
      await fetch(`/api/audio/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
    } catch (error) {
      console.error('[RecordingStore] Failed to delete from database:', error);
    }
  }, []);

  // Get recordings that need retry (saved or uploading with audioData)
  const getRecordingsNeedingRetry = useCallback(() => {
    return recordings.filter(rec =>
      (rec.status === 'saved' || rec.status === 'uploading') && rec.audioData
    );
  }, [recordings]);

  return {
    recordings,
    isLoading,
    saveRecording,
    updateRecording,
    getTodayRecordings,
    deleteRecording,
    getRecordingsNeedingRetry,
  };
}
