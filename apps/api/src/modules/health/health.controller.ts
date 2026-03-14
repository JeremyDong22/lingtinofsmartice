import {
  Controller,
  Get,
  Query,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { HealthService } from './health.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly healthService: HealthService) {}

  private static readonly SYSTEM_ADMIN_USERS = [
    'hr901027', 'Jeremy', 'hengwu', 'liuyun', 'yangxue',
    'chenhua', 'xuguangquan', 'fanshucen', 'geyi',
  ];

  private checkAccess(user: AuthUser) {
    if (!HealthController.SYSTEM_ADMIN_USERS.includes(user.username)) {
      throw new ForbiddenException('Access denied');
    }
  }

  @Get('latest')
  async getLatest(@CurrentUser() user: AuthUser) {
    this.checkAccess(user);
    this.logger.log('▶ GET /health/latest');
    return this.healthService.getLatest();
  }

  @Get('history')
  async getHistory(
    @CurrentUser() user: AuthUser,
    @Query('days') daysStr?: string,
  ) {
    this.checkAccess(user);
    const days = parseInt(daysStr || '7', 10) || 7;
    this.logger.log(`▶ GET /health/history (days=${days})`);
    return this.healthService.getHistory(days);
  }

  @Get('status')
  async getHeartbeatStatus(@CurrentUser() user: AuthUser) {
    this.checkAccess(user);
    this.logger.log('▶ GET /health/status');
    return this.healthService.getHeartbeatStatus();
  }

  @Get('feedback-digest/latest')
  async getLatestDigest(@CurrentUser() user: AuthUser) {
    this.checkAccess(user);
    this.logger.log('▶ GET /health/feedback-digest/latest');
    return this.healthService.getLatestDigest();
  }

  @Get('feedback-digest/history')
  async getDigestHistory(
    @CurrentUser() user: AuthUser,
    @Query('days') daysStr?: string,
  ) {
    this.checkAccess(user);
    const days = parseInt(daysStr || '7', 10) || 7;
    this.logger.log(`▶ GET /health/feedback-digest/history (days=${days})`);
    return this.healthService.getDigestHistory(days);
  }
}
