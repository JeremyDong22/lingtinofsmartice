// Audio Pending API Route - Get pending records for recovery after page refresh
// v1.0 - Fetches pending records from backend for automatic retry

import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET() {
  try {
    const response = await fetch(`${API_URL}/api/audio/pending`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
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
