import { NextRequest, NextResponse } from 'next/server';
import { query, ensureInit } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { v4 as uuid } from 'uuid';

export async function GET(req: NextRequest) {
  await ensureInit();
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (code) {
    const r = await query(`SELECT * FROM coupons WHERE code = $1 AND active = true AND (max_uses IS NULL OR uses_count < max_uses) AND (expires_at IS NULL OR expires_at > NOW())`, [code.toUpperCase()]);
    if (!r.rows.length) return NextResponse.json({ success: false, error: 'Cupón no válido o expirado' }, { status: 404 });
    const c = r.rows[0];
    return NextResponse.json({ success: true, data: { id: c.id, code: c.code, type: c.type, value: parseFloat(c.value), min_order_usd: c.min_order_usd } });
  }

  const auth = await requireAdmin(req);
  if (auth) return auth;
  const r = await query('SELECT * FROM coupons ORDER BY created_at DESC');
  return NextResponse.json({ success: true, data: r.rows });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  await ensureInit();
  const body = await req.json();
  const id = uuid();
  await query('INSERT INTO coupons (id, code, type, value, max_uses, min_order_usd, expires_at, active) VALUES ($1,$2,$3,$4,$5,$6,$7,true)',
    [id, (body.code || '').toUpperCase(), body.type || 'percentage', body.value, body.max_uses || null, body.min_order_usd || null, body.expires_at || null]);
  return NextResponse.json({ success: true, data: { id } }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  await ensureInit();
  const body = await req.json();
  if (body.active !== undefined) {
    await query('UPDATE coupons SET active = $1 WHERE id = $2', [body.active, body.id]);
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  await ensureInit();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'id requerido' }, { status: 400 });
  await query('DELETE FROM coupons WHERE id = $1', [id]);
  return NextResponse.json({ success: true });
}
