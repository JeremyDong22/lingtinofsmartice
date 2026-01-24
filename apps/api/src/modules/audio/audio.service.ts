// Audio Service - Business logic for recording processing
// v2.1 - Added mock mode support for local development

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';

@Injectable()
export class AudioService {
  private readonly logger = new Logger(AudioService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async uploadAndProcess(
    file: Express.Multer.File,
    tableId: string,
    restaurantId: string,
    employeeId?: string,
    recordingId?: string,
  ) {
    this.logger.log(`Uploading audio for table ${tableId}, recording ${recordingId}`);

    // Check if running in mock mode
    if (this.supabase.isMockMode()) {
      this.logger.warn('[MOCK] Simulating audio upload');
      const mockUrl = `https://mock-storage.local/${restaurantId}/${Date.now()}_${tableId}.webm`;

      const visitRecord = await this.supabase.createVisitRecord({
        id: recordingId,
        restaurant_id: restaurantId,
        employee_id: employeeId,
        table_id: tableId,
        audio_url: mockUrl,
        visit_period: new Date().getHours() < 15 ? 'lunch' : 'dinner',
      });

      return {
        visit_id: visitRecord.id,
        recording_id: recordingId,
        status: 'uploaded',
        audioUrl: mockUrl,
      };
    }

    // Production: Upload to Supabase Storage
    const client = this.supabase.getClient();
    const fileName = `${restaurantId}/${Date.now()}_${tableId}.webm`;

    const { error: uploadError } = await client.storage
      .from('visit-recordings')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = client.storage
      .from('visit-recordings')
      .getPublicUrl(fileName);

    const hour = new Date().getHours();
    const visitPeriod = hour < 15 ? 'lunch' : 'dinner';

    const visitRecord = await this.supabase.createVisitRecord({
      id: recordingId,
      restaurant_id: restaurantId,
      employee_id: employeeId,
      table_id: tableId,
      audio_url: urlData.publicUrl,
      visit_period: visitPeriod,
    });

    return {
      visit_id: visitRecord.id,
      recording_id: recordingId,
      status: 'uploaded',
      audioUrl: urlData.publicUrl,
    };
  }

  async getProcessingStatus(visitId: string) {
    if (this.supabase.isMockMode()) {
      this.logger.warn('[MOCK] Returning mock status');
      return {
        visit_id: visitId,
        status: 'processed',
        processed_at: new Date().toISOString(),
        error_message: null,
        ai_summary: '顾客对菜品满意',
      };
    }

    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('lingtin_visit_records')
      .select('id, status, processed_at, error_message, ai_summary')
      .eq('id', visitId)
      .single();

    if (error) throw error;

    return {
      visit_id: data.id,
      status: data.status,
      processed_at: data.processed_at,
      error_message: data.error_message,
      ai_summary: data.ai_summary,
    };
  }
}
