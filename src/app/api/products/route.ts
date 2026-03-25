import { NextRequest, NextResponse } from 'next/server';
import { query, ensureInit, usdToCop, getExchangeRate } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { v4 as uuid } from 'uuid';
import slugify from 'slugify';
import type { Product } from '@/types';

export async function GET(req: NextRequest) {
  await ensureInit();
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const category = searchParams.get('category');
  const status = searchParams.get('status') || 'published';
  const supplier = searchParams.get('supplier');
  const search = searchParams.get('search');
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  const token = req.cookies.get('ltc_admin_token');
  if (!token && status !== 'all') {
    conditions.push(`p.status = $${idx++}`); params.push('published');
  } else if (status && status !== 'all') {
    conditions.push(`p.status = $${idx++}`); params.push(status);
  }
  if (category) { conditions.push(`p.category = $${idx++}`); params.push(category); }
  if (supplier) { conditions.push(`p.supplier = $${idx++}`); params.push(supplier); }
  if (search) {
    conditions.push(`(p.title ILIKE $${idx} OR p.description ILIKE $${idx+1})`);
    params.push(`%${search}%`, `%${search}%`); idx += 2;
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const totalRes = await query(`SELECT COUNT(*) as c FROM products p ${where}`, params);
  const total = parseInt(totalRes.rows[0].c);

  const rows = await query(`
    SELECT p.*,
      json_agg(json_build_object('id', pi.id, 'url', pi.url, 'alt', pi.alt, 'is_primary', pi.is_primary, 'sort_order', pi.sort_order)
        ORDER BY pi.is_primary DESC, pi.sort_order ASC) FILTER (WHERE pi.id IS NOT NULL) as images_json
    FROM products p
    LEFT JOIN product_images pi ON pi.product_id = p.id
    ${where}
    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT $${idx} OFFSET $${idx+1}
  `, [...params, limit, offset]);

  const products = rows.rows.map(parseProduct);

  return NextResponse.json({ success: true, data: { items: products, total, page, per_page: limit, total_pages: Math.ceil(total / limit) } });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  await ensureInit();

  const body = await req.json();
  const id = uuid();
  const slug = await generateUniqueSlug(body.slug || body.title);
  const priceCop = await usdToCop(body.price_usd);

  await query(`
    INSERT INTO products (id, slug, title, title_en, description, description_en,
      price_usd, price_usd_original, price_cop, price_old_usd, category, supplier,
      supplier_url, supplier_sku, stock, status, preventa_enabled, preventa_percent,
      preventa_launch_date, meta_title, meta_description, seo_keywords,
      publisher, author, year, isbn, characters, franchise)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
  `, [
    id, slug, body.title, body.title_en || null, body.description || '', body.description_en || null,
    body.price_usd, body.price_usd_original || null, priceCop, body.price_old_usd || null,
    body.category || 'comics', body.supplier || 'manual', body.supplier_url || null, body.supplier_sku || null,
    body.stock || 0, body.status || 'draft',
    body.preventa_enabled || false, body.preventa_percent || 30, body.preventa_launch_date || null,
    body.meta_title || null, body.meta_description || null,
    JSON.stringify(body.seo_keywords || []),
    body.publisher || null, body.author || null, body.year || null, body.isbn || null,
    JSON.stringify(body.characters || []), body.franchise || null,
  ]);

  if (body.images?.length) {
    for (let i = 0; i < body.images.length; i++) {
      const img = body.images[i];
      await query('INSERT INTO product_images (id, product_id, url, alt, is_primary, sort_order) VALUES ($1,$2,$3,$4,$5,$6)',
        [uuid(), id, img.url, img.alt || '', i === 0, i]);
    }
  }

  return NextResponse.json({ success: true, data: { id, slug } }, { status: 201 });
}

async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugify(title, { lower: true, strict: true });
  let slug = base;
  let i = 1;
  while (true) {
    const r = await query('SELECT id FROM products WHERE slug = $1', [slug]);
    if (!r.rows.length) break;
    slug = `${base}-${i++}`;
  }
  return slug;
}

export function parseProduct(row: any): Product {
  const images = (row.images_json || []).filter((i: any) => i && i.id);
  return {
    id: row.id, slug: row.slug, title: row.title, title_en: row.title_en,
    description: row.description, description_en: row.description_en,
    price_usd: parseFloat(row.price_usd), price_usd_original: row.price_usd_original ? parseFloat(row.price_usd_original) : undefined,
    price_cop: parseInt(row.price_cop), price_old_usd: row.price_old_usd ? parseFloat(row.price_old_usd) : undefined,
    images, category: row.category, supplier: row.supplier,
    supplier_url: row.supplier_url, supplier_sku: row.supplier_sku,
    stock: row.stock, status: row.status,
    preventa_enabled: Boolean(row.preventa_enabled),
    preventa_percent: row.preventa_percent || 30,
    preventa_launch_date: row.preventa_launch_date,
    meta_title: row.meta_title, meta_description: row.meta_description,
    seo_keywords: row.seo_keywords || [],
    publisher: row.publisher, author: row.author, year: row.year,
    isbn: row.isbn, characters: row.characters || [], franchise: row.franchise,
    created_at: row.created_at, updated_at: row.updated_at,
  };
}
