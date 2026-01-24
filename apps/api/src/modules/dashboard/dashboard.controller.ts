// Dashboard Controller - API endpoints for analytics
// v1.0

import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // GET /api/dashboard/coverage
  @Get('coverage')
  async getCoverage(
    @Query('restaurant_id') restaurantId: string,
    @Query('date') date?: string,
  ) {
    return this.dashboardService.getCoverageStats(
      restaurantId,
      date || new Date().toISOString().split('T')[0],
    );
  }

  // GET /api/dashboard/dish-ranking
  @Get('dish-ranking')
  async getDishRanking(
    @Query('restaurant_id') restaurantId: string,
    @Query('date') date?: string,
    @Query('limit') limit?: string,
  ) {
    return this.dashboardService.getDishRanking(
      restaurantId,
      date || new Date().toISOString().split('T')[0],
      parseInt(limit || '5', 10),
    );
  }

  // GET /api/dashboard/sentiment-trend
  @Get('sentiment-trend')
  async getSentimentTrend(
    @Query('restaurant_id') restaurantId: string,
    @Query('days') days?: string,
  ) {
    return this.dashboardService.getSentimentTrend(
      restaurantId,
      parseInt(days || '7', 10),
    );
  }
}
