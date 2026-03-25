import { NextRequest, NextResponse } from 'next/server';
import { liveSearch } from '@/lib/livesearch';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const category = searchParams.get('category') || 'general';

  if (!q) return NextResponse.json({ error: 'q required' }, { status: 400 });

  const products = await liveSearch(q, category);
  return NextResponse.json({ success: true, data: products });
}
