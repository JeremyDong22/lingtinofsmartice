// Action Items Controller - API endpoints for AI action suggestions
// v3.1 - Added batch-create for guided review, fixed route ordering

import { Controller, Get, Post, Patch, Delete, Query, Param, Body } from '@nestjs/common';
import { ActionItemsService } from './action-items.service';
import { getChinaDateString } from '../../common/utils/date';

@Controller('action-items')
export class ActionItemsController {
  constructor(private readonly actionItemsService: ActionItemsService) {}

  // GET /api/action-items/pending — all pending/acknowledged items across dates
  @Get('pending')
  async getPendingActionItems(
    @Query('restaurant_id') restaurantId: string,
    @Query('limit') limit?: string,
    @Query('include_audio') includeAudio?: string,
  ) {
    return this.actionItemsService.getPendingActionItems(
      restaurantId,
      limit ? parseInt(limit, 10) : 20,
      includeAudio === 'true',
    );
  }

  // GET /api/action-items — list action items for a date
  @Get()
  async getActionItems(
    @Query('restaurant_id') restaurantId: string,
    @Query('date') date?: string,
  ) {
    return this.actionItemsService.getActionItems(
      restaurantId,
      date || getChinaDateString(),
    );
  }

  // POST /api/action-items/batch-create — create multiple action items at once (guided review)
  // Must be declared before @Post() to avoid route shadowing
  @Post('batch-create')
  async batchCreateActionItems(
    @Body() body: {
      restaurant_id: string;
      items: Array<{
        suggestion_text: string;
        assigned_role?: string;
        deadline?: string;
        category?: string;
        priority?: string;
      }>;
      source_meeting_id?: string;
    },
  ) {
    return this.actionItemsService.batchCreateActionItems(body);
  }

  // POST /api/action-items/batch-confirm — confirm multiple action items at once
  @Post('batch-confirm')
  async batchConfirmActionItems(
    @Body() body: { ids: string[] },
  ) {
    return this.actionItemsService.batchConfirmActionItems(body.ids);
  }

  // POST /api/action-items — create a single action item
  @Post()
  async createActionItem(
    @Body() body: {
      restaurant_id: string;
      suggestion_text: string;
      assigned_role?: string;
      deadline?: string;
      category?: string;
      priority?: string;
      source_meeting_id?: string;
    },
  ) {
    return this.actionItemsService.createActionItem(body);
  }

  // PATCH /api/action-items/:id — update status or edit content
  @Patch(':id')
  async updateActionItem(
    @Param('id') id: string,
    @Body() body: {
      status?: string;
      suggestion_text?: string;
      assigned_role?: string;
      deadline?: string;
      note?: string;
      response_note?: string;
    },
  ) {
    return this.actionItemsService.updateActionItem(id, body);
  }

  // DELETE /api/action-items/:id — delete an action item
  @Delete(':id')
  async deleteActionItem(@Param('id') id: string) {
    return this.actionItemsService.deleteActionItem(id);
  }
}
