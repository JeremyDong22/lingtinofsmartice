// Hotword Module - DashScope vocabulary management (CRUD + sync + AI extract)
// v1.0

import { Module } from '@nestjs/common';
import { HotwordController } from './hotword.controller';
import { HotwordService } from './hotword.service';
import { DashScopeVocabularyService } from './dashscope-vocabulary.service';
import { HotwordAiService } from './hotword-ai.service';

@Module({
  controllers: [HotwordController],
  providers: [HotwordService, DashScopeVocabularyService, HotwordAiService],
})
export class HotwordModule {}
