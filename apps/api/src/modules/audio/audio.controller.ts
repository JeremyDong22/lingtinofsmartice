// Audio Controller - API endpoints for recording
// v2.1 - Added request logging for debugging

import {
  Controller,
  Post,
  Get,
  Param,
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

    this.logger.log(`◀ Process complete: ${result.sentiment} (${result.sentimentScore})`);

    return {
      success: true,
      transcript: result.transcript,
      correctedTranscript: result.correctedTranscript,
      aiSummary: result.aiSummary,
      sentiment: result.sentiment,
      sentimentScore: result.sentimentScore,
    };
  }

  // GET /api/audio/status/:visit_id
  @Get('status/:visitId')
  async getStatus(@Param('visitId') visitId: string) {
    this.logger.log(`▶ GET /audio/status/${visitId}`);
    return this.audioService.getProcessingStatus(visitId);
  }
}
