// Chat API Route - Streaming proxy to NestJS backend
// v1.0

import { NextRequest } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, restaurant_id, session_id } = body;

    // Create streaming response from backend
    const response = await fetch(`${API_URL}/api/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        restaurant_id: restaurant_id || 'demo-restaurant-id',
        session_id,
      }),
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: 'Chat request failed' }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Forward the SSE stream
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process chat request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
