import { Module } from '@nestjs/common';
import { ActionItemsModule } from '../action-items/action-items.module';
import { DailySummaryController } from './daily-summary.controller';
import { DailySummaryService } from './daily-summary.service';

@Module({
  imports: [ActionItemsModule],
  controllers: [DailySummaryController],
  providers: [DailySummaryService],
})
export class DailySummaryModule {}
