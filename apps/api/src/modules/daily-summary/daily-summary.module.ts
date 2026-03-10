import { Module } from '@nestjs/common';
import { DailySummaryController } from './daily-summary.controller';
import { DailySummaryService } from './daily-summary.service';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [KnowledgeModule],
  controllers: [DailySummaryController],
  providers: [DailySummaryService],
  exports: [DailySummaryService],
})
export class DailySummaryModule {}
