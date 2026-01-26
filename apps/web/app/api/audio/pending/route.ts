// Audio Pending API Route - Get pending records for recovery after page refresh
// v1.1 - Added: Forward Authorization header for authentication

import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');

    // Build headers with auth
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(`${API_URL}/api/audio/pending`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch pending records' }));
      return NextResponse.json(
        { error: error.message || 'Failed to fetch pending records' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Fetch pending records error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending records' },
      { status: 500 }
    );
  }
}
