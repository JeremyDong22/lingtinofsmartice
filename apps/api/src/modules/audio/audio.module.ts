// Audio Module - Handle recording uploads and AI processing
// v2.3 - Knowledge injection for AI analysis

import { Module } from '@nestjs/common';
import { AudioController } from './audio.controller';
import { AudioService } from './audio.service';
import { AiProcessingService } from './ai-processing.service';
import { XunfeiSttService } from './xunfei-stt.service';
import { DashScopeSttService } from './dashscope-stt.service';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [KnowledgeModule],
  controllers: [AudioController],
  providers: [AudioService, AiProcessingService, XunfeiSttService, DashScopeSttService],
  exports: [AudioService, AiProcessingService, XunfeiSttService, DashScopeSttService],
})
export class AudioModule {}
