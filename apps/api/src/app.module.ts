// Root Application Module
// v1.6 - Added ActivityLoggerInterceptor for user activity tracking

import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ActivityLoggerInterceptor } from './common/interceptors/activity-logger.interceptor';
import { AudioModule } from './modules/audio/audio.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ChatModule } from './modules/chat/chat.module';
import { StaffModule } from './modules/staff/staff.module';
import { ActionItemsModule } from './modules/action-items/action-items.module';
import { QuestionTemplatesModule } from './modules/question-templates/question-templates.module';
import { MeetingModule } from './modules/meeting/meeting.module';
import { DailySummaryModule } from './modules/daily-summary/daily-summary.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { RegionModule } from './modules/region/region.module';
import { HotwordModule } from './modules/hotword/hotword.module';
import { ActivityModule } from './modules/activity/activity.module';
import { AuthModule, JwtAuthGuard } from './modules/auth';
import { SupabaseModule } from './common/supabase/supabase.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    SupabaseModule,
    AuthModule,
    AudioModule,
    DashboardModule,
    ChatModule,
    StaffModule,
    ActionItemsModule,
    QuestionTemplatesModule,
    MeetingModule,
    DailySummaryModule,
    FeedbackModule,
    RegionModule,
    HotwordModule,
    ActivityModule,
  ],
  providers: [
    // Apply JWT guard globally - all routes require auth by default
    // Use @Public() decorator to make specific routes public
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Log all API requests for user activity tracking
    {
      provide: APP_INTERCEPTOR,
      useClass: ActivityLoggerInterceptor,
    },
  ],
})
export class AppModule {}
