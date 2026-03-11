// Landing Analytics Controller - Public event ingestion + authenticated stats

import { Controller, Post, Get, Body, Query, Logger, BadRequestException } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { LandingAnalyticsService } from './landing-analytics.service';

interface EventDto {
  visitor_id: string;
  session_id: string;
  event_type: string;
  payload?: Record<string, unknown>;
  referrer?: string;
  user_agent?: string;
  screen_width?: number;
  screen_height?: number;
}

@Controller('landing-analytics')
export class LandingAnalyticsController {
  private readonly logger = new Logger(LandingAnalyticsController.name);

  constructor(private readonly service: LandingAnalyticsService) {}

  @Public()
  @Post('events')
  async ingestEvents(@Body() body: { events: EventDto[] }) {
    const events = body?.events;
    if (!Array.isArray(events) || events.length === 0) {
      throw new BadRequestException('events array required');
    }

    // Cap at 50 events per request to prevent abuse
    const capped = events.slice(0, 50);
    await this.service.insertEvents(capped);

    return { data: null, message: 'ok' };
  }

  @Get('stats')
  async getStats(@Query('days') daysStr?: string) {
    const days = Math.min(Math.max(parseInt(daysStr || '7', 10) || 7, 1), 90);
    const data = await this.service.getStats(days);
    return { data, message: '查询成功' };
  }
}
