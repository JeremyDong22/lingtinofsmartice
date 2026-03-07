// Pending Processor Service - Polls for direct-upload records and runs AI pipeline
// v1.0 - Picks up visit_records with status='pending' that have audio_url (created by
//         frontend direct upload fallback) and triggers STT + AI processing.
//         Also handles pending meeting_records.

import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { AiProcessingService } from './ai-processing.service';
import { MeetingAiProcessingService } from '../meeting/meeting-ai-processing.service';
import { getChinaHour } from '../../common/utils/date';

// Poll every 60 seconds
const POLL_INTERVAL_MS = 60_000;
// Only process records older than 2 minutes (give backend time to handle normally)
const MIN_AGE_MINUTES = 2;
// Records stuck in 'processing' for longer than this are considered crashed
const STUCK_PROCESSING_MINUTES = 10;
// Max records per poll cycle (avoid overloading)
const BATCH_SIZE = 3;

@Injectable()
export class PendingProcessorService {
  private readonly logger = new Logger(PendingProcessorService.name);
  private isProcessing = false;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly aiProcessing: AiProcessingService,
    private readonly meetingAiProcessing: MeetingAiProcessingService,
  ) {}

  @Interval(POLL_INTERVAL_MS)
  async pollPendingRecords() {
    // Only run during business hours (Beijing time 06:00-23:00)
    const hour = getChinaHour();
    if (hour < 6 || hour >= 23) return;

    // Prevent concurrent polling
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      await this.recoverStuckRecords();
      await this.processVisitRecords();
      await this.processMeetingRecords();
    } catch (error) {
      this.logger.error('Pending processor poll failed', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Recover records stuck in 'processing' status (process crashed without cleanup)
  private async recoverStuckRecords() {
    const client = this.supabase.getClient();
    const cutoff = new Date(Date.now() - STUCK_PROCESSING_MINUTES * 60 * 1000).toISOString();

    // Reset stuck visit records
    const { data: stuckVisits, error: visitErr } = await client
      .from('lingtin_visit_records')
      .update({ status: 'pending' })
      .eq('status', 'processing')
      .lt('updated_at', cutoff)
      .select('id');

    if (!visitErr && stuckVisits?.length) {
      this.logger.warn(`Reset ${stuckVisits.length} stuck visit record(s) from 'processing' to 'pending'`);
    }

    // Reset stuck meeting records
    const { data: stuckMeetings, error: meetingErr } = await client
      .from('lingtin_meeting_records')
      .update({ status: 'pending' })
      .eq('status', 'processing')
      .lt('updated_at', cutoff)
      .select('id');

    if (!meetingErr && stuckMeetings?.length) {
      this.logger.warn(`Reset ${stuckMeetings.length} stuck meeting record(s) from 'processing' to 'pending'`);
    }
  }

  // Process pending visit records (from direct upload fallback)
  private async processVisitRecords() {
    const client = this.supabase.getClient();
    const cutoff = new Date(Date.now() - MIN_AGE_MINUTES * 60 * 1000).toISOString();

    const { data: records, error } = await client
      .from('lingtin_visit_records')
      .select('id, audio_url, table_id, restaurant_id')
      .eq('status', 'pending')
      .not('audio_url', 'is', null)
      .lt('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (error) {
      this.logger.error('Failed to query pending visit records', error.message);
      return;
    }
    if (!records || records.length === 0) return;

    this.logger.log(`Found ${records.length} pending visit record(s) to process`);

    for (const record of records) {
      try {
        this.logger.log(`Processing pending visit: ${record.id} (table: ${record.table_id})`);
        await this.aiProcessing.processAudio(
          record.id,
          record.audio_url,
          record.table_id,
          record.restaurant_id,
        );
        this.logger.log(`Successfully processed pending visit: ${record.id}`);
      } catch (error) {
        // processAudio already handles status updates and lock checks
        // "already processed/processing" errors are expected and safe to ignore
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('already')) {
          this.logger.log(`Visit ${record.id} already handled: ${msg}`);
        } else {
          this.logger.error(`Failed to process pending visit ${record.id}: ${msg}`);
        }
      }
    }
  }

  // Process pending meeting records (from direct upload fallback)
  private async processMeetingRecords() {
    const client = this.supabase.getClient();
    const cutoff = new Date(Date.now() - MIN_AGE_MINUTES * 60 * 1000).toISOString();

    const { data: records, error } = await client
      .from('lingtin_meeting_records')
      .select('id, audio_url, meeting_type, restaurant_id')
      .eq('status', 'pending')
      .not('audio_url', 'is', null)
      .lt('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (error) {
      this.logger.error('Failed to query pending meeting records', error.message);
      return;
    }
    if (!records || records.length === 0) return;

    this.logger.log(`Found ${records.length} pending meeting record(s) to process`);

    for (const record of records) {
      try {
        this.logger.log(`Processing pending meeting: ${record.id} (type: ${record.meeting_type})`);
        await this.meetingAiProcessing.processMeeting(
          record.id,
          record.audio_url,
          record.meeting_type,
          record.restaurant_id,
        );
        this.logger.log(`Successfully processed pending meeting: ${record.id}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('already')) {
          this.logger.log(`Meeting ${record.id} already handled: ${msg}`);
        } else {
          this.logger.error(`Failed to process pending meeting ${record.id}: ${msg}`);
        }
      }
    }
  }
}
