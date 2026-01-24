// Chat Controller - API endpoints for AI assistant
// v1.1 - Fixed Response type for SSE streaming

import { Controller, Post, Get, Body, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // POST /api/chat/message - Stream response
  @Post('message')
  async sendMessage(
    @Body('message') message: string,
    @Body('restaurant_id') restaurantId: string,
    @Body('session_id') sessionId: string | undefined,
    @Res() res: Response,
  ) {
    // Set headers for SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    await this.chatService.streamResponse(message, restaurantId, sessionId, res);
  }

  // GET /api/chat/sessions - List chat sessions
  @Get('sessions')
  async getSessions(@Query('restaurant_id') restaurantId: string) {
    return this.chatService.getSessions(restaurantId);
  }
}
