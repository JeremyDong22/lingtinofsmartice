// Action Items Module - AI-generated improvement suggestions
// v2.0 - Added KnowledgeModule for experience extraction on resolution

import { Module } from '@nestjs/common';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ActionItemsController } from './action-items.controller';
import { ActionItemsService } from './action-items.service';

@Module({
  imports: [KnowledgeModule],
  controllers: [ActionItemsController],
  providers: [ActionItemsService],
  exports: [ActionItemsService],
})
export class ActionItemsModule {}
