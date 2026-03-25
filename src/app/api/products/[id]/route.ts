import { NextRequest, NextResponse } from 'next/server';
import { query, ensureInit, usdToCop } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { parseProduct } from '../route';
import { v4 as uuid } from 'uuid';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit();
  const r = await query(`
    SELECT p.*, json_agg(json_build_object('id', pi.id, 'url', pi.url, 'alt', pi.alt, 'is_primary', pi.is_primary, 'sort_order', pi.sort_order)
      ORDER BY pi.is_primary DESC, pi.sort_order ASC) FILTER (WHERE pi.id IS NOT NULL) as images_json
    FROM products p LEFT JOIN product_images pi ON pi.product_id = p.id
    WHERE p.id = $1 OR p.slug = $1 GROUP BY p.id
  `, [params.id]);
  if (!r.rows.length) return NextResponse.json({ success: false, error: 'Producto no encontrado' }, { status: 404 });
  return NextResponse.json({ success: true, data: parseProduct(r.rows[0]) });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  await ensureInit();
  const body = await req.json();

  const priceCop = body.price_usd ? await usdToCop(body.price_usd) : null;

  await query(`
    UPDATE products SET
      title = COALESCE($1, title), title_en = COALESCE($2, title_en),
      description = COALESCE($3, description), description_en = COALESCE($4, description_en),
      price_usd = COALESCE($5, price_usd), price_usd_original = COALESCE($6, price_usd_original),
      price_cop = COALESCE($7, price_cop), price_old_usd = $8,
      category = COALESCE($9, category), supplier = COALESCE($10, supplier),
      supplier_url = COALESCE($11, supplier_url), supplier_sku = COALESCE($12, supplier_sku),
      stock = COALESCE($13, stock), status = COALESCE($14, status),
      preventa_enabled = COALESCE($15, preventa_enabled),
      preventa_percent = COALESCE($16, preventa_percent),
      preventa_launch_date = $17, meta_title = $18, meta_description = $19,
      seo_keywords = COALESCE($20, seo_keywords),
      publisher = $21, author = $22, franchise = $23,
      updated_at = NOW()
    WHERE id = $24
  `, [
    body.title ?? null, body.title_en ?? null,
    body.description ?? null, body.description_en ?? null,
    body.price_usd ?? null, body.price_usd_original ?? null,
    priceCop, body.price_old_usd ?? null,
    body.category ?? null, body.supplier ?? null,
    body.supplier_url ?? null, body.supplier_sku ?? null,
    body.stock ?? null, body.status ?? null,
    body.preventa_enabled !== undefined ? body.preventa_enabled : null,
    body.preventa_percent ?? null,
    body.preventa_launch_date ?? null,
    body.meta_title ?? null, body.meta_description ?? null,
    body.seo_keywords ? JSON.stringify(body.seo_keywords) : null,
    body.publisher ?? null, body.author ?? null, body.franchise ?? null,
    params.id,
  ]);

  if (body.images !== undefined) {
    await query('DELETE FROM product_images WHERE product_id = $1', [params.id]);
    if (body.images?.length) {
      for (let i = 0; i < body.images.length; i++) {
        const img = body.images[i];
        await query('INSERT INTO product_images (id, product_id, url, alt, is_primary, sort_order) VALUES ($1,$2,$3,$4,$5,$6)',
          [uuid(), params.id, img.url, img.alt || '', i === 0, i]);
      }
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  await ensureInit();
  await query('DELETE FROM products WHERE id = $1', [params.id]);
  return NextResponse.json({ success: true });
}
