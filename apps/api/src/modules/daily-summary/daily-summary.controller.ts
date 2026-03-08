import { Controller, Get, Post, Query } from '@nestjs/common';
import { DailySummaryService } from './daily-summary.service';
import { getChinaDateString } from '../../common/utils/date';

@Controller('daily-summary')
export class DailySummaryController {
  constructor(private readonly dailySummaryService: DailySummaryService) {}

  @Get()
  async getDailySummary(
    @Query('restaurant_id') restaurantId: string,
    @Query('date') date?: string,
  ) {
    return this.dailySummaryService.getDailySummary(
      restaurantId,
      date || getChinaDateString(),
    );
  }

  @Post('generate')
  async generateDailySummary(
    @Query('restaurant_id') restaurantId: string,
    @Query('date') date?: string,
  ) {
    return this.dailySummaryService.generateDailySummary(
      restaurantId,
      date || getChinaDateString(),
    );
  }

  /** Called by pg_cron via pg_net — generates summaries for all restaurants with visits today */
  @Post('cron-trigger')
  async cronTrigger(@Query('date') date?: string) {
    return this.dailySummaryService.triggerAllSummaries(
      date || getChinaDateString(),
    );
  }
}
