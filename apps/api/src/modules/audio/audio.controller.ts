// Audio Controller - API endpoints for recording
// v3.4 - Added PATCH status endpoint for error recovery

import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Param,
  Query,
  Body,
  UploadedFile,
  UseInterceptors,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AudioService } from './audio.service';
import { AiProcessingService } from './ai-processing.service';

@Controller('audio')
export class AudioController {
  private readonly logger = new Logger(AudioController.name);

  constructor(
    private readonly audioService: AudioService,
    private readonly aiProcessingService: AiProcessingService,
  ) {}

  // POST /api/audio/upload
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAudio(
    @UploadedFile() file: Express.Multer.File,
    @Body('table_id') tableId: string,
    @Body('restaurant_id') restaurantId: string,
    @Body('recording_id') recordingId?: string,
    @Body('employee_id') employeeId?: string,
  ) {
    this.logger.log(`▶ POST /audio/upload`);
    this.logger.log(`  Table: ${tableId} | Recording: ${recordingId}`);
    this.logger.log(`  File: ${file?.originalname} (${file?.size} bytes)`);

    const result = await this.audioService.uploadAndProcess(
      file,
      tableId,
      restaurantId,
      employeeId,
      recordingId,
    );

    this.logger.log(`◀ Upload complete: ${result.audioUrl}`);
    return result;
  }

  // POST /api/audio/process - Trigger AI pipeline
  @Post('process')
  async processAudio(
    @Body('recording_id') recordingId: string,
    @Body('audio_url') audioUrl: string,
    @Body('table_id') tableId: string,
    @Body('restaurant_id') restaurantId: string,
  ) {
    this.logger.log(`▶ POST /audio/process`);
    this.logger.log(`  Recording: ${recordingId} | Table: ${tableId}`);
    this.logger.log(`  Audio URL: ${audioUrl}`);

    const result = await this.aiProcessingService.processAudio(
      recordingId,
      audioUrl,
      tableId,
      restaurantId,
    );

    this.logger.log(`◀ Process complete: score=${result.sentimentScore}, feedbacks=${result.feedbacks.length}`);

    return {
      success: true,
      transcript: result.transcript,
      correctedTranscript: result.correctedTranscript,
      aiSummary: result.aiSummary,
      sentimentScore: result.sentimentScore,
      feedbacks: result.feedbacks,
      managerQuestions: result.managerQuestions,
      customerAnswers: result.customerAnswers,
    };
  }

  // GET /api/audio/status/:visit_id
  @Get('status/:visitId')
  async getStatus(@Param('visitId') visitId: string) {
    this.logger.log(`▶ GET /audio/status/${visitId}`);
    return this.audioService.getProcessingStatus(visitId);
  }

  // GET /api/audio/pending - Get pending records for recovery
  @Get('pending')
  async getPendingRecords() {
    this.logger.log(`▶ GET /audio/pending`);
    const records = await this.audioService.getPendingRecords();
    this.logger.log(`◀ Found ${records.length} pending records`);
    return { records };
  }

  // GET /api/audio/today - Get today's recordings for a restaurant
  @Get('today')
  async getTodayRecordings(@Query('restaurant_id') restaurantId: string) {
    this.logger.log(`▶ GET /audio/today?restaurant_id=${restaurantId}`);
    const records = await this.audioService.getTodayRecordings(restaurantId);
    this.logger.log(`◀ Found ${records.length} recordings`);
    return { records };
  }

  // DELETE /api/audio/:visitId - Delete a recording
  @Delete(':visitId')
  async deleteRecording(@Param('visitId') visitId: string) {
    this.logger.log(`▶ DELETE /audio/${visitId}`);
    await this.audioService.deleteRecording(visitId);
    this.logger.log(`◀ Deleted recording ${visitId}`);
    return { success: true };
  }

  // PATCH /api/audio/:visitId/status - Update recording status (for error recovery)
  @Patch(':visitId/status')
  async updateStatus(
    @Param('visitId') visitId: string,
    @Body('status') status: string,
    @Body('error_message') errorMessage?: string,
  ) {
    this.logger.log(`▶ PATCH /audio/${visitId}/status → ${status}`);
    await this.audioService.updateRecordingStatus(visitId, status, errorMessage);
    this.logger.log(`◀ Status updated to ${status}`);
    return { success: true };
  }
}
