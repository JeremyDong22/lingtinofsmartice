// Dashboard Dish Ranking API Route - Proxy to NestJS backend
// v1.0

import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get('restaurant_id') || 'demo-restaurant-id';
    const date = searchParams.get('date');
    const limit = searchParams.get('limit') || '5';

    const url = new URL(`${API_URL}/api/dashboard/dish-ranking`);
    url.searchParams.set('restaurant_id', restaurantId);
    url.searchParams.set('limit', limit);
    if (date) url.searchParams.set('date', date);

    const response = await fetch(url.toString());

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
