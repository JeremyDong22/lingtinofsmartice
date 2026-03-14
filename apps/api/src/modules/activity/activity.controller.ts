// Activity Controller - User activity tracking endpoints
// v1.1 - Whitelist-based access control (was hr901027-only)

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

  private static readonly SYSTEM_ADMIN_USERS = [
    'hr901027', 'Jeremy', 'hengwu', 'liuyun', 'yangxue',
    'chenhua', 'xuguangquan', 'fanshucen', 'geyi',
  ];

  private checkAccess(user: AuthUser) {
    if (!ActivityController.SYSTEM_ADMIN_USERS.includes(user.username)) {
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
