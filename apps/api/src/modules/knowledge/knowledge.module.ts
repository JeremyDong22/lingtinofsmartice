import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { LearningWorkerService } from './learning-worker.service';
import { KnowledgeBootstrapService } from './knowledge-bootstrap.service';

@Module({
  controllers: [KnowledgeController],
  providers: [KnowledgeService, LearningWorkerService, KnowledgeBootstrapService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
