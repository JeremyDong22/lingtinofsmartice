import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { LearningWorkerService } from './learning-worker.service';

@Module({
  controllers: [KnowledgeController],
  providers: [KnowledgeService, LearningWorkerService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
