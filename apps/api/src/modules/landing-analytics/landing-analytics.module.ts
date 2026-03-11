// Landing Analytics Module - Event tracking for landing page PMF metrics

import { Module } from '@nestjs/common';
import { LandingAnalyticsController } from './landing-analytics.controller';
import { LandingAnalyticsService } from './landing-analytics.service';

@Module({
  controllers: [LandingAnalyticsController],
  providers: [LandingAnalyticsService],
})
export class LandingAnalyticsModule {}
