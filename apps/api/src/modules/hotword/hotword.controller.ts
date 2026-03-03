// Hotword Controller - REST endpoints for hotword management
// v1.0 - CRUD + batch + menu-diff + menu-import + AI extract + sync + seed

import {
  Controller, Get, Post, Patch, Delete,
  Query, Param, Body, BadRequestException,
} from '@nestjs/common';
import { HotwordService } from './hotword.service';
import { HotwordAiService } from './hotword-ai.service';

@Controller('hotwords')
export class HotwordController {
  constructor(
    private readonly service: HotwordService,
    private readonly aiService: HotwordAiService,
  ) {}

  // GET /api/hotwords — list with optional search/category/source filter
  @Get()
  async list(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('source') source?: string,
  ) {
    return this.service.list({ search, category, source });
  }

  // GET /api/hotwords/stats — total, enabled, last sync
  @Get('stats')
  async stats() {
    return this.service.getStats();
  }

  // GET /api/hotwords/menu-diff — compare menu dishes vs hotwords
  @Get('menu-diff')
  async menuDiff() {
    return this.service.getMenuDiff();
  }

  // POST /api/hotwords — add single hotword
  @Post()
  async create(
    @Body() body: { text: string; weight?: number; category?: string },
  ) {
    if (!body.text?.trim()) throw new BadRequestException('text is required');
    if (body.text.trim().length > 10) throw new BadRequestException('热词不能超过10个字');
    return this.service.create(body);
  }

  // PATCH /api/hotwords/:id — update weight/category/enabled
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { weight?: number; category?: string; is_enabled?: boolean },
  ) {
    return this.service.update(id, body);
  }

  // DELETE /api/hotwords/:id — delete single hotword
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.delete(id);
  }

  // POST /api/hotwords/batch — batch add hotwords
  @Post('batch')
  async batchCreate(
    @Body() body: { items: Array<{ text: string; weight?: number; category?: string; source?: string }> },
  ) {
    if (!body.items?.length) throw new BadRequestException('items is required');
    return this.service.batchCreate(body.items);
  }

  // DELETE /api/hotwords/batch — batch delete by IDs
  @Delete('batch')
  async batchDelete(@Body() body: { ids: string[] }) {
    if (!body.ids?.length) throw new BadRequestException('ids is required');
    return this.service.batchDelete(body.ids);
  }

  // POST /api/hotwords/menu-import — import selected dishes
  @Post('menu-import')
  async menuImport(@Body() body: { dishes: string[] }) {
    if (!body.dishes?.length) throw new BadRequestException('dishes is required');
    return this.service.menuImport(body.dishes);
  }

  // POST /api/hotwords/ai-extract — AI extract hotwords from text
  @Post('ai-extract')
  async aiExtract(
    @Body() body: { text: string; mode: 'menu' | 'general' },
  ) {
    if (!body.text?.trim()) throw new BadRequestException('text is required');
    if (!['menu', 'general'].includes(body.mode)) throw new BadRequestException('mode must be "menu" or "general"');
    const words = await this.aiService.extract(body.text, body.mode);
    return { data: words };
  }

  // POST /api/hotwords/sync — sync enabled hotwords to DashScope
  @Post('sync')
  async sync() {
    return this.service.syncToDashScope();
  }

  // POST /api/hotwords/seed — seed from existing DashScope vocabulary
  @Post('seed')
  async seed() {
    return this.service.seedFromDashScope();
  }
}
