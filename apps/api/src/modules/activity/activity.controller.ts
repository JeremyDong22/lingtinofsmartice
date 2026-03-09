// Activity Controller - User activity tracking endpoints
// v1.0 - Overview + user timeline, restricted to hr901027

import {
  Controller,
  Get,
  Param,
  Query,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ActivityService } from './activity.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.service';

@Controller('activity')
export class ActivityController {
  private readonly logger = new Logger(ActivityController.name);

  constructor(private readonly activityService: ActivityService) {}

  private checkAccess(user: AuthUser) {
    if (user.username !== 'hr901027') {
      throw new ForbiddenException('Access denied');
    }
  }

  @Get('overview')
  async getOverview(
    @CurrentUser() user: AuthUser,
    @Query('days') daysStr?: string,
  ) {
    this.checkAccess(user);
    const days = parseInt(daysStr || '7', 10) || 7;
    this.logger.log(`▶ GET /activity/overview (days=${days})`);
    return this.activityService.getOverview(days);
  }

  @Get('user/:userId')
  async getUserTimeline(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
    @Query('days') daysStr?: string,
    @Query('page') pageStr?: string,
  ) {
    this.checkAccess(user);
    const days = parseInt(daysStr || '7', 10) || 7;
    const page = parseInt(pageStr || '1', 10) || 1;
    this.logger.log(
      `▶ GET /activity/user/${userId} (days=${days}, page=${page})`,
    );
    return this.activityService.getUserTimeline(userId, days, page);
  }
}
