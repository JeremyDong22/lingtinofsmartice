// Dashboard Dish Ranking API Route - Proxy to NestJS backend
// v1.3 - Added: Forward Authorization header for authentication

import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
// Must match DEFAULT_RESTAURANT_ID in backend supabase.service.ts
const DEMO_RESTAURANT_ID = '0b9e9031-4223-4124-b633-e3a853abfb8f';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get('restaurant_id') || DEMO_RESTAURANT_ID;
    const date = searchParams.get('date');
    const limit = searchParams.get('limit') || '5';
    const authHeader = request.headers.get('Authorization');

    const url = new URL(`${API_URL}/api/dashboard/dish-ranking`);
    url.searchParams.set('restaurant_id', restaurantId);
    url.searchParams.set('limit', limit);
    if (date) url.searchParams.set('date', date);

    // Build headers with auth
    const headers: HeadersInit = {};
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch dish ranking' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Dish ranking fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dish ranking' },
      { status: 500 }
    );
  }
}
