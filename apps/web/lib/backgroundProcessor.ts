// Background Processor - Handles async upload and AI pipeline
// v1.1 - Added detailed console logging for debugging

import { Recording, RecordingStatus } from '@/hooks/useRecordingStore';

interface ProcessingCallbacks {
  onStatusChange: (id: string, status: RecordingStatus, data?: Partial<Recording>) => void;
  onError: (id: string, error: string) => void;
}

// Logger prefix for easy filtering
const LOG_PREFIX = '[Lingtin Pipeline]';

function log(message: string, data?: unknown) {
  console.log(`${LOG_PREFIX} ${message}`, data || '');
}

function logError(message: string, error?: unknown) {
  console.error(`${LOG_PREFIX} ERROR: ${message}`, error || '');
}

// Convert base64 to Blob
function base64ToBlob(base64: string): Blob {
  const parts = base64.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], { type: contentType });
}

export async function processRecordingInBackground(
  recording: Recording,
  callbacks: ProcessingCallbacks
) {
  const { id, tableId, audioData } = recording;
  const startTime = Date.now();

  log(`Starting pipeline for recording ${id} (table: ${tableId})`);

  if (!audioData) {
    logError(`Recording ${id} has no audio data`);
    callbacks.onError(id, '录音数据丢失');
    return;
  }

  try {
    // Step 1: Upload to cloud storage
    log(`[Step 1/3] Uploading audio to cloud storage...`);
    callbacks.onStatusChange(id, 'uploading');

    const audioBlob = base64ToBlob(audioData);
    log(`Audio blob created: ${(audioBlob.size / 1024).toFixed(1)} KB`);

    const formData = new FormData();
    formData.append('file', audioBlob, `${tableId}_${Date.now()}.webm`);
    formData.append('table_id', tableId);
    formData.append('recording_id', id);
    formData.append('restaurant_id', 'demo-restaurant-id');

    const uploadStartTime = Date.now();
    const uploadResponse = await fetch('/api/audio/upload', {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      logError(`Upload failed: ${uploadResponse.status}`, errorText);
      throw new Error(`上传失败: ${uploadResponse.status}`);
    }

    const uploadResult = await uploadResponse.json();
    log(`[Step 1/3] Upload complete in ${Date.now() - uploadStartTime}ms`, uploadResult);

    // Step 2: Trigger AI pipeline processing
    log(`[Step 2/3] Starting AI processing (STT + Gemini)...`);
    callbacks.onStatusChange(id, 'processing', {
      audioUrl: uploadResult.audioUrl,
    });

    const processStartTime = Date.now();
    const processResponse = await fetch('/api/audio/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recording_id: id,
        audio_url: uploadResult.audioUrl,
        table_id: tableId,
        restaurant_id: 'demo-restaurant-id',
      }),
    });

    if (!processResponse.ok) {
      const errorText = await processResponse.text();
      logError(`AI processing failed: ${processResponse.status}`, errorText);
      throw new Error(`处理失败: ${processResponse.status}`);
    }

    const processResult = await processResponse.json();
    log(`[Step 2/3] AI processing complete in ${Date.now() - processStartTime}ms`, processResult);

    // Step 3: Update with results
    log(`[Step 3/3] Updating UI with results...`);
    callbacks.onStatusChange(id, 'completed', {
      transcript: processResult.transcript,
      correctedTranscript: processResult.correctedTranscript,
      aiSummary: processResult.aiSummary,
      sentiment: processResult.sentiment,
      sentimentScore: processResult.sentimentScore,
    });

    const totalTime = Date.now() - startTime;
    log(`Pipeline complete! Total time: ${totalTime}ms`, {
      id,
      tableId,
      sentiment: processResult.sentiment,
      summary: processResult.aiSummary,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : '处理失败';
    logError(`Pipeline failed for ${id}`, error);
    callbacks.onError(id, message);
    callbacks.onStatusChange(id, 'error', { errorMessage: message });
  }
}

// Batch processor for retrying failed recordings
export async function retryFailedRecordings(
  recordings: Recording[],
  callbacks: ProcessingCallbacks
) {
  const failed = recordings.filter(r => r.status === 'error');
  log(`Retrying ${failed.length} failed recordings`);

  for (const recording of failed) {
    await processRecordingInBackground(recording, callbacks);
  }
}
