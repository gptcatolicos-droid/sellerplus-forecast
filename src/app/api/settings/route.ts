import { NextRequest, NextResponse } from 'next/server';
import { query, ensureInit } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  await ensureInit();
  const { searchParams } = new URL(req.url);
  const keys = searchParams.get('keys')?.split(',') || [];
  
  if (!keys.length) {
    const r = await query('SELECT key, value FROM settings');
    const obj: Record<string, string> = {};
    r.rows.forEach((row: any) => { obj[row.key] = row.value; });
    return NextResponse.json(obj);
  }

  const obj: Record<string, string> = {};
  for (const key of keys) {
    const r = await query('SELECT value FROM settings WHERE key = $1', [key.trim()]);
    if (r.rows.length) obj[key.trim()] = r.rows[0].value;
  }
  return NextResponse.json(obj);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  await ensureInit();
  
  const body = await req.json();
  for (const [key, value] of Object.entries(body)) {
    await query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      [key, String(value)]
    );
  }
  return NextResponse.json({ success: true });
}
