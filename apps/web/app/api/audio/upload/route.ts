// Audio Upload API Route - Proxy to NestJS backend
// v1.1 - Added: Forward Authorization header for authentication

import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const authHeader = request.headers.get('Authorization');

    // Forward the FormData to the NestJS backend with auth header
    const headers: HeadersInit = {};
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(`${API_URL}/api/audio/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.message || 'Upload failed' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Audio upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload audio' },
      { status: 500 }
    );
  }
}
