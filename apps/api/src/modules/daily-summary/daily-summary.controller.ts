import { Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { DailySummaryService } from './daily-summary.service';
import { getChinaDateString } from '../../common/utils/date';
import { Public } from '../auth/public.decorator';

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

  /** Called by pg_cron via pg_net — fire-and-forget, returns immediately */
  @Public()
  @Post('cron-trigger')
  @HttpCode(202)
  cronTrigger(@Query('date') date?: string) {
    const targetDate = date || getChinaDateString();
    // Fire and forget — don't await, return immediately to avoid HTTP timeout
    this.dailySummaryService.triggerAllSummaries(targetDate).catch(() => {});
    return { accepted: true, date: targetDate };
  }
}
