// Meeting Module - Handle meeting recordings and AI minutes generation
// v3.0 - Added KnowledgeModule for meeting knowledge extraction

import { Module } from '@nestjs/common';
import { AudioModule } from '../audio/audio.module';
import { DailySummaryModule } from '../daily-summary/daily-summary.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { MeetingController } from './meeting.controller';
import { MeetingService } from './meeting.service';
import { MeetingAiProcessingService } from './meeting-ai-processing.service';
import { PendingProcessorService } from '../audio/pending-processor.service';

@Module({
  imports: [AudioModule, DailySummaryModule, KnowledgeModule],
  controllers: [MeetingController],
  providers: [MeetingService, MeetingAiProcessingService, PendingProcessorService],
})
export class MeetingModule {}
