import { NextRequest, NextResponse } from 'next/server';
import { query, ensureInit, usdToCop } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  await ensureInit();
  const body = await req.json();
  const { action } = body;

  if (action === 'price_update') {
    const { type, value, apply_to, category, product_ids } = body;
    let rows;
    if (apply_to === 'category' && category) {
      rows = await query('SELECT id, price_usd FROM products WHERE category = $1', [category]);
    } else if (apply_to === 'selected' && product_ids?.length) {
      rows = await query(`SELECT id, price_usd FROM products WHERE id = ANY($1)`, [product_ids]);
    } else {
      rows = await query('SELECT id, price_usd FROM products');
    }
    for (const p of rows.rows) {
      const newPrice = type === 'percentage'
        ? Math.round(parseFloat(p.price_usd) * (1 + value / 100) * 100) / 100
        : Math.round((parseFloat(p.price_usd) + value) * 100) / 100;
      const cop = await usdToCop(newPrice);
      await query('UPDATE products SET price_usd = $1, price_cop = $2, updated_at = NOW() WHERE id = $3', [newPrice, cop, p.id]);
    }
    return NextResponse.json({ success: true, updated: rows.rows.length });
  }

  if (action === 'stock_update') {
    for (const u of (body.updates || [])) {
      await query('UPDATE products SET stock = $1, updated_at = NOW() WHERE id = $2', [u.new_stock, u.product_id]);
    }
    return NextResponse.json({ success: true });
  }

  if (action === 'status_update') {
    const { product_ids, status } = body;
    await query(`UPDATE products SET status = $1, updated_at = NOW() WHERE id = ANY($2)`, [status, product_ids]);
    return NextResponse.json({ success: true });
  }

  if (action === 'delete') {
    await query(`DELETE FROM products WHERE id = ANY($1)`, [body.product_ids]);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: 'Acción no reconocida' }, { status: 400 });
}
