// Audio Module - Handle recording uploads and AI processing
// v2.0 - Added AI processing service

import { Module } from '@nestjs/common';
import { AudioController } from './audio.controller';
import { AudioService } from './audio.service';
import { AiProcessingService } from './ai-processing.service';

@Module({
  controllers: [AudioController],
  providers: [AudioService, AiProcessingService],
  exports: [AudioService, AiProcessingService],
})
export class AudioModule {}
