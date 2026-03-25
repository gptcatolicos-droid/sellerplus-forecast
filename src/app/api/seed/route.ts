import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { ensureInit } from '@/lib/db';
import { seedAmazonProducts } from '@/lib/seed-amazon';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  await ensureInit();
  const results = await seedAmazonProducts();
  return NextResponse.json({ success: true, results });
}

// Also auto-seed on GET for easy triggering
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  await ensureInit();
  const results = await seedAmazonProducts();
  return NextResponse.json({ success: true, results });
}
