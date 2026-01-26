// Background Processor - Handles async upload and AI pipeline
// v1.3 - Added: retryPendingFromDatabase() to recover interrupted processing on page load

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
    // Use visit_id (UUID from database) instead of frontend recording ID
    // This ensures the AI results can be saved to the correct database record
    const processResponse = await fetch('/api/audio/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recording_id: uploadResult.visit_id,
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

// Retry pending records from database (for recovery after page refresh)
// This fetches records that have audio_url but are still in 'pending' status
export async function retryPendingFromDatabase(
  onProgress?: (message: string) => void
): Promise<{ processed: number; failed: number }> {
  log('Checking for pending records in database...');

  let processed = 0;
  let failed = 0;

  try {
    // Fetch pending records from API
    const response = await fetch('/api/audio/pending');

    if (!response.ok) {
      logError(`Failed to fetch pending records: ${response.status}`);
      return { processed: 0, failed: 0 };
    }

    const { records } = await response.json();

    if (!records || records.length === 0) {
      log('No pending records found');
      return { processed: 0, failed: 0 };
    }

    log(`Found ${records.length} pending records to process`);
    onProgress?.(`发现 ${records.length} 条待处理录音`);

    // Process each pending record
    for (const record of records) {
      try {
        log(`Processing pending record: ${record.id} (table: ${record.table_id})`);
        onProgress?.(`正在处理 ${record.table_id} 桌录音...`);

        const processResponse = await fetch('/api/audio/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recording_id: record.id,
            audio_url: record.audio_url,
            table_id: record.table_id,
            restaurant_id: record.restaurant_id || 'demo-restaurant-id',
          }),
        });

        if (processResponse.ok) {
          log(`Successfully processed: ${record.id}`);
          processed++;
        } else {
          const errorText = await processResponse.text();
          logError(`Failed to process ${record.id}`, errorText);
          failed++;
        }
      } catch (error) {
        logError(`Error processing ${record.id}`, error);
        failed++;
      }
    }

    log(`Pending recovery complete: ${processed} processed, ${failed} failed`);
    if (processed > 0) {
      onProgress?.(`已完成 ${processed} 条录音处理`);
    }

    return { processed, failed };
  } catch (error) {
    logError('Failed to retry pending records', error);
    return { processed: 0, failed: 0 };
  }
}
