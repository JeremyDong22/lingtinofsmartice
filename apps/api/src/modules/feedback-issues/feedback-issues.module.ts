import { Module } from '@nestjs/common';
import { FeedbackIssuesController } from './feedback-issues.controller';
import { FeedbackIssuesService } from './feedback-issues.service';

@Module({
  controllers: [FeedbackIssuesController],
  providers: [FeedbackIssuesService],
  exports: [FeedbackIssuesService],
})
export class FeedbackIssuesModule {}
