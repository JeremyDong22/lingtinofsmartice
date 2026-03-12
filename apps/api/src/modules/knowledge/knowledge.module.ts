import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { LearningWorkerService } from './learning-worker.service';
import { KnowledgeBootstrapService } from './knowledge-bootstrap.service';
import { KnowledgeExtractorService } from './knowledge-extractor.service';

@Module({
  controllers: [KnowledgeController],
  providers: [KnowledgeService, LearningWorkerService, KnowledgeBootstrapService, KnowledgeExtractorService],
  exports: [KnowledgeService, KnowledgeExtractorService],
})
export class KnowledgeModule {}
