import { NextRequest, NextResponse } from 'next/server';
import { query, ensureInit } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { sendTrackingNotification } from '@/lib/email';
import { parseOrder } from '../route';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit();
  const r = await query('SELECT * FROM orders WHERE id = $1 OR order_number = $1', [params.id]);
  if (!r.rows.length) return NextResponse.json({ success: false, error: 'Pedido no encontrado' }, { status: 404 });
  return NextResponse.json({ success: true, data: await parseOrder(r.rows[0]) });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  await ensureInit();

  const body = await req.json();
  const { status, tracking_number, tracking_carrier, notes } = body;

  const r = await query('SELECT * FROM orders WHERE id = $1', [params.id]);
  if (!r.rows.length) return NextResponse.json({ success: false, error: 'Pedido no encontrado' }, { status: 404 });

  const updates: string[] = ['updated_at = NOW()'];
  const vals: any[] = [];
  let idx = 1;

  if (status) { updates.push(`status = $${idx++}`); vals.push(status); }
  if (notes !== undefined) { updates.push(`notes = $${idx++}`); vals.push(notes); }

  let shouldSendTracking = false;
  if (tracking_number && tracking_number !== r.rows[0].tracking_number) {
    updates.push(`tracking_number = $${idx++}`, `tracking_carrier = $${idx++}`, `tracking_notified_at = NOW()`);
    vals.push(tracking_number, tracking_carrier || 'USPS');
    shouldSendTracking = true;
    if (!status) { updates.push(`status = $${idx++}`); vals.push('shipped'); }
  }

  await query(`UPDATE orders SET ${updates.join(', ')} WHERE id = $${idx}`, [...vals, params.id]);

  if (shouldSendTracking) {
    const updated = await query('SELECT * FROM orders WHERE id = $1', [params.id]);
    const order = await parseOrder(updated.rows[0]);
    sendTrackingNotification(order).catch(e => console.error('Tracking email error:', e));
  }

  return NextResponse.json({ success: true });
}
