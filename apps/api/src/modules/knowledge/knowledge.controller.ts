import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.service';
import {
  KnowledgeService,
  KnowledgeScope,
  KnowledgeType,
  KnowledgeCategory,
  KnowledgeStatus,
  ReviewStatus,
  SourceType,
  AIOperation,
} from './knowledge.service';
import { LearningWorkerService } from './learning-worker.service';
import { KnowledgeBootstrapService } from './knowledge-bootstrap.service';

@Controller('knowledge')
export class KnowledgeController {
  private readonly logger = new Logger(KnowledgeController.name);

  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly learningWorker: LearningWorkerService,
    private readonly bootstrapService: KnowledgeBootstrapService,
  ) {}

  private assertKnowledgeAdmin(user: AuthUser) {
    if (!user || user.username !== 'hr901027') {
      throw new ForbiddenException('知识引擎管理权限未开放');
    }
  }

  // ─── Knowledge CRUD ───────────────────────────────────────────────

  @Get('list')
  async listKnowledge(
    @Query('restaurant_id') restaurantId?: string,
    @Query('scope') scope?: KnowledgeScope,
    @Query('knowledge_type') knowledgeType?: KnowledgeType,
    @Query('status') status?: KnowledgeStatus,
    @Query('review_status') reviewStatus?: ReviewStatus,
    @Query('limit') limit?: string,
  ) {
    const data = await this.knowledgeService.listKnowledge({
      restaurant_id: restaurantId,
      scope,
      knowledge_type: knowledgeType,
      status,
      review_status: reviewStatus,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { data };
  }

  @Get('relevant')
  async getRelevant(
    @Query('restaurant_id') restaurantId: string,
    @Query('operation') operation: AIOperation,
  ) {
    if (!restaurantId || !operation) {
      return { data: null, message: 'restaurant_id and operation required' };
    }
    const data = await this.knowledgeService.getRelevantKnowledge(
      restaurantId,
      operation,
    );
    const { raw, ...sections } = data;
    return { data: sections, count: raw.length };
  }

  @Post('upsert')
  async upsertKnowledge(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      restaurant_id?: string;
      brand_id?: number;
      region_id?: string;
      scope: KnowledgeScope;
      knowledge_type: KnowledgeType;
      category?: KnowledgeCategory;
      title?: string;
      content: Record<string, unknown>;
      quality_score?: number;
      confidence?: number;
      source_signal?: string;
      source_type?: SourceType;
      source_data?: Record<string, unknown>;
      auto_approve?: boolean;
    },
  ) {
    this.assertKnowledgeAdmin(user);
    const result = await this.knowledgeService.upsertKnowledge(body);
    if (result.error) {
      return { data: null, message: result.error };
    }
    return { data: result.data, message: 'Knowledge upserted' };
  }

  @Post('create')
  async createKnowledge(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      restaurant_id?: string;
      brand_id?: number;
      region_id?: string;
      scope: KnowledgeScope;
      knowledge_type: KnowledgeType;
      category?: KnowledgeCategory;
      title?: string;
      content: Record<string, unknown>;
      quality_score?: number;
      confidence?: number;
      source_signal?: string;
      source_type?: SourceType;
      source_data?: Record<string, unknown>;
      auto_approve?: boolean;
    },
  ) {
    this.assertKnowledgeAdmin(user);
    const result = await this.knowledgeService.createKnowledge(body);
    if (result.error) {
      return { data: null, message: result.error };
    }
    return { data: result.data, message: 'Knowledge created' };
  }

  @Post('archive')
  async archiveKnowledge(
    @CurrentUser() user: AuthUser,
    @Body('id') id: string,
  ) {
    this.assertKnowledgeAdmin(user);
    if (!id) return { data: null, message: 'id required' };
    const success = await this.knowledgeService.archiveKnowledge(id);
    return {
      data: { archived: success },
      message: success ? 'Archived' : 'Failed to archive',
    };
  }

  // ─── HITL Review Workflow ─────────────────────────────────────────

  @Get('review-queue')
  async getReviewQueue(
    @Query('status') status?: ReviewStatus,
    @Query('knowledge_type') knowledgeType?: KnowledgeType,
    @Query('restaurant_id') restaurantId?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.knowledgeService.getReviewQueue({
      review_status: status,
      knowledge_type: knowledgeType,
      restaurant_id: restaurantId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { data, count: data.length };
  }

  @Post(':id/approve')
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body('note') note?: string,
    @Body('new_category') newCategory?: KnowledgeCategory,
  ) {
    this.assertKnowledgeAdmin(user);
    const result = await this.knowledgeService.approveKnowledge(
      id,
      user.username,
      note,
      newCategory,
    );
    return {
      data: { approved: result.success },
      message: result.success
        ? 'Knowledge approved'
        : result.error || 'Failed to approve',
    };
  }

  @Post(':id/revise')
  async revise(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body('note') note: string,
  ) {
    this.assertKnowledgeAdmin(user);
    if (!note) {
      return { data: null, message: 'Revision note is required' };
    }
    const result = await this.knowledgeService.reviseKnowledge(
      id,
      user.username,
      note,
    );
    return {
      data: { revised: result.success },
      message: result.success
        ? 'Revision requested'
        : result.error || 'Failed to request revision',
    };
  }

  @Post(':id/reject')
  async reject(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body('note') note: string,
  ) {
    this.assertKnowledgeAdmin(user);
    if (!note) {
      return { data: null, message: 'Rejection reason is required' };
    }
    const result = await this.knowledgeService.rejectKnowledge(
      id,
      user.username,
      note,
    );
    return {
      data: { rejected: result.success },
      message: result.success
        ? 'Knowledge rejected'
        : result.error || 'Failed to reject',
    };
  }

  @Get('review-history')
  async getReviewHistory(@Query('days') days?: string) {
    const data = await this.knowledgeService.getReviewHistory(
      days ? parseInt(days, 10) : undefined,
    );
    return { data, count: data.length };
  }

  // ─── Version Management ───────────────────────────────────────────

  @Get(':id/versions')
  async getVersions(@Param('id') id: string) {
    const data = await this.knowledgeService.getVersionHistory(id);
    return { data, count: data.length };
  }

  @Post(':id/new-version')
  async createNewVersion(
    @Param('id') id: string,
    @Body()
    body: {
      content: Record<string, unknown>;
      title?: string;
      confidence?: number;
      source_type?: SourceType;
      auto_approve?: boolean;
    },
  ) {
    if (!body.content) {
      return { data: null, message: 'content required' };
    }
    const result = await this.knowledgeService.createVersion(id, body.content, {
      title: body.title,
      confidence: body.confidence,
      source_type: body.source_type,
      auto_approve: body.auto_approve,
    });
    if (result.error) {
      return { data: null, message: result.error };
    }
    return { data: result.data, message: 'New version created' };
  }

  // ─── Learning Events ─────────────────────────────────────────────

  @Get('events')
  async getEvents(@Query('limit') limit?: string) {
    const data = await this.knowledgeService.getRecentLearningEvents(
      limit ? parseInt(limit, 10) : undefined,
    );
    return { data };
  }

  // ─── AI Metrics ──────────────────────────────────────────────────

  @Get('metrics')
  async getMetrics(
    @Query('metric_type') metricType: string,
    @Query('restaurant_id') restaurantId?: string,
    @Query('days') days?: string,
  ) {
    if (!metricType) return { data: [], message: 'metric_type required' };
    const data = await this.knowledgeService.getMetrics({
      metric_type: metricType,
      restaurant_id: restaurantId,
      days: days ? parseInt(days, 10) : undefined,
    });
    return { data };
  }

  @Post('metrics')
  async recordMetric(
    @Body()
    body: {
      metric_date: string;
      restaurant_id?: string;
      metric_type: string;
      metric_value: Record<string, unknown>;
    },
  ) {
    if (!body.metric_type || !body.metric_date || !body.metric_value) {
      return {
        data: null,
        message: 'metric_type, metric_date, and metric_value required',
      };
    }
    const success = await this.knowledgeService.recordMetric(body);
    return {
      data: { recorded: success },
      message: success ? 'Metric recorded' : 'Failed to record',
    };
  }

  // ─── Worker Triggers (for manual testing) ─────────────────────────

  @Post('worker/decay')
  async triggerDecay(@CurrentUser() user: AuthUser) {
    this.assertKnowledgeAdmin(user);
    const result = await this.knowledgeService.decayKnowledgeScores();
    const archiveResult = await this.knowledgeService.autoArchiveStale();
    return {
      data: { decayed: result.updated, archived: archiveResult.archived },
      message: 'Decay and auto-archive completed',
    };
  }

  @Post('worker/distill')
  async triggerDistillation(@CurrentUser() user: AuthUser) {
    this.assertKnowledgeAdmin(user);
    const result = await this.learningWorker.triggerDistillation();
    return {
      data: result,
      message: `Distillation complete: L2=${result.vertical}, L3=${result.horizontal}, L4=${result.action}`,
    };
  }

  @Post('worker/explore')
  async triggerExploration(@CurrentUser() user: AuthUser) {
    this.assertKnowledgeAdmin(user);
    const result = await this.learningWorker.runExploratoryDistillation();
    return {
      data: result,
      message: `Exploratory distillation complete: ${result.discovered} discoveries`,
    };
  }

  @Post('worker/revisions')
  async triggerRevisions(@CurrentUser() user: AuthUser) {
    this.assertKnowledgeAdmin(user);
    await this.learningWorker.processRevisions();
    return { data: { processed: true }, message: 'Revisions processed' };
  }

  @Post('worker/bootstrap')
  async triggerBootstrap(@CurrentUser() user: AuthUser) {
    this.assertKnowledgeAdmin(user);
    if (this.bootstrapService.isRunning()) {
      return {
        data: { status: 'already_running' },
        message: 'Bootstrap is already running',
      };
    }
    // Fire-and-forget: run in background to avoid gateway timeout
    this.bootstrapService.bootstrapAll().then(result => {
      this.logger.log(
        `Bootstrap finished: ${result.rulesCreated} rules, ${result.profilesCreated} profiles, ${result.errors.length} errors`,
      );
    }).catch(err => {
      this.logger.error(`Bootstrap failed: ${err}`);
    });
    return {
      data: { status: 'started' },
      message: 'Bootstrap started in background. Use GET /knowledge/worker/bootstrap-status to check progress.',
    };
  }

  @Get('worker/bootstrap-status')
  async getBootstrapStatus() {
    return {
      data: {
        running: this.bootstrapService.isRunning(),
        progress: this.bootstrapService.getProgress(),
      },
    };
  }

  @Post('worker/chat-analysis')
  async triggerChatAnalysis(@CurrentUser() user: AuthUser) {
    this.assertKnowledgeAdmin(user);
    await this.learningWorker.analyzeChatPatterns();
    return { data: { processed: true }, message: 'Chat analysis complete' };
  }

  @Post('worker/behavior-analysis')
  async triggerBehaviorAnalysis(@CurrentUser() user: AuthUser) {
    this.assertKnowledgeAdmin(user);
    await this.learningWorker.analyzeUserBehavior();
    return { data: { processed: true }, message: 'Behavior analysis complete' };
  }

  @Post('worker/impact-evaluation')
  async triggerImpactEvaluation(@CurrentUser() user: AuthUser) {
    this.assertKnowledgeAdmin(user);
    await this.learningWorker.evaluateActionImpact();
    return { data: { processed: true }, message: 'Impact evaluation complete' };
  }
}
