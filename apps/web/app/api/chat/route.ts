// Chat API Route - Streaming proxy to NestJS backend
// v1.4 - Cleaned up debug logs for production

import { NextRequest } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, restaurant_id, session_id, history } = body;
    const authHeader = request.headers.get('Authorization');

    // Build headers with auth
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    // Create streaming response from backend
    const response = await fetch(`${API_URL}/api/chat/message`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        restaurant_id: restaurant_id || 'demo-restaurant-id',
        session_id,
        history,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: 'Chat request failed', details: errorText }),
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
    return new Response(
      JSON.stringify({ error: 'Failed to process chat request', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
