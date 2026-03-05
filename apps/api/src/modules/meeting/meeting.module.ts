// Meeting Module - Handle meeting recordings and AI minutes generation
// v2.0 - Added DailySummaryModule for review meeting context

import { Module } from '@nestjs/common';
import { AudioModule } from '../audio/audio.module';
import { DailySummaryModule } from '../daily-summary/daily-summary.module';
import { MeetingController } from './meeting.controller';
import { MeetingService } from './meeting.service';
import { MeetingAiProcessingService } from './meeting-ai-processing.service';
import { PendingProcessorService } from '../audio/pending-processor.service';

@Module({
  imports: [AudioModule, DailySummaryModule],
  controllers: [MeetingController],
  providers: [MeetingService, MeetingAiProcessingService, PendingProcessorService],
})
export class MeetingModule {}
