import { Module } from '@nestjs/common';
import { DailySummaryController } from './daily-summary.controller';
import { DailySummaryService } from './daily-summary.service';

@Module({
  controllers: [DailySummaryController],
  providers: [DailySummaryService],
})
export class DailySummaryModule {}
