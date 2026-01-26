// Audio Processing API Route - Orchestrates STT and AI tagging pipeline
// v1.1 - Added: Forward Authorization header for authentication

import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recording_id, audio_url, table_id, restaurant_id } = body;
    const authHeader = request.headers.get('Authorization');

    // Build headers with auth
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    // Forward to NestJS backend for processing
    const response = await fetch(`${API_URL}/api/audio/process`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        recording_id,
        audio_url,
        table_id,
        restaurant_id,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Processing failed' }));
      return NextResponse.json(
        { error: error.message || 'Processing failed' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Audio processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process audio' },
      { status: 500 }
    );
  }
}
