import { Controller, Get, Patch, Post, Query, Param, Body } from '@nestjs/common';
import { FeedbackIssuesService } from './feedback-issues.service';

@Controller('feedback-issues')
export class FeedbackIssuesController {
  constructor(private readonly service: FeedbackIssuesService) {}

  @Get('management-summary')
  async getManagementSummary(
    @Query('managed_ids') managedIds?: string,
  ) {
    const ids = managedIds ? managedIds.split(',').filter(Boolean) : undefined;
    return this.service.getManagementSummary(ids);
  }

  @Get('raw-timeline')
  async getRawTimeline(
    @Query('restaurant_id') restaurantId: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const dateRange = start && end ? { start, end } : undefined;
    return this.service.getRawTimeline(restaurantId, dateRange);
  }

  @Get()
  async getIssues(
    @Query('restaurant_id') restaurantId: string,
    @Query('classification') classification?: string,
    @Query('category') category?: string,
    @Query('role') role?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getIssues(restaurantId, {
      classification,
      category,
      role,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Patch(':id/classify')
  async classifyIssue(
    @Param('id') id: string,
    @Body() body: {
      role: 'manager' | 'head_chef';
      classification: 'resolved' | 'todo' | 'dismissed';
      note?: string;
      action_by?: string;
    },
  ) {
    return this.service.classifyIssue(
      id,
      body.role,
      body.classification,
      body.note,
      body.action_by,
    );
  }

  @Patch(':id/management-reply')
  async replyToIssue(
    @Param('id') id: string,
    @Body() body: { reply: string; reply_by: string },
  ) {
    return this.service.replyToIssue(id, body.reply, body.reply_by);
  }

  @Patch(':id/mark-reply-read')
  async markReplyRead(
    @Param('id') id: string,
    @Body() body: { role: 'manager' | 'head_chef' },
  ) {
    return this.service.markReplyRead(id, body.role);
  }

  @Post('trigger')
  async triggerRollup() {
    return this.service.runDailyRollup();
  }

  @Post('backfill')
  async backfill(
    @Query('days') days?: string,
    @Query('restaurant_id') restaurantId?: string,
  ) {
    return this.service.backfillHistorical(
      days ? parseInt(days, 10) : 30,
      restaurantId,
    );
  }
}
