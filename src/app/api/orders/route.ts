import { NextRequest, NextResponse } from 'next/server';
import { query, ensureInit, getShippingRate, usdToCop } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { sendOrderConfirmation } from '@/lib/email';
import { createPaymentPreference } from '@/lib/mercadopago';
import { v4 as uuid } from 'uuid';
import type { Order, OrderItem, ShippingZone } from '@/types';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  await ensureInit();

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (status && status !== 'all') { conditions.push(`status = $${idx++}`); params.push(status); }
  if (search) {
    conditions.push(`(order_number ILIKE $${idx} OR customer_email ILIKE $${idx+1} OR customer_name ILIKE $${idx+2})`);
    params.push(`%${search}%`, `%${search}%`, `%${search}%`); idx += 3;
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const totalRes = await query(`SELECT COUNT(*) as c FROM orders ${where}`, params);
  const total = parseInt(totalRes.rows[0].c);
  const rows = await query(`SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx+1}`, [...params, limit, offset]);
  const orders = await Promise.all(rows.rows.map(r => parseOrder(r)));

  return NextResponse.json({ success: true, data: { items: orders, total, page, per_page: limit, total_pages: Math.ceil(total / limit) } });
}

export async function POST(req: NextRequest) {
  await ensureInit();
  const body = await req.json();
  const { customer, shipping_address, items, coupon_code, shipping_zone } = body;

  let discountUsd = 0;
  let coupon: any = null;
  if (coupon_code) {
    const r = await query(`SELECT * FROM coupons WHERE code = $1 AND active = true AND (expires_at IS NULL OR expires_at > NOW())`, [coupon_code]);
    coupon = r.rows[0];
  }

  let subtotalUsd = 0;
  const enrichedItems: OrderItem[] = [];

  for (const item of items) {
    const pr = await query('SELECT * FROM products WHERE id = $1', [item.product_id]);
    const product = pr.rows[0];
    if (!product || product.status !== 'published') return NextResponse.json({ success: false, error: `Producto no disponible: ${item.product_id}` }, { status: 400 });
    if (product.stock < item.quantity && product.stock !== -1) return NextResponse.json({ success: false, error: `Stock insuficiente: ${product.title}` }, { status: 400 });

    const priceUsd = parseFloat(product.price_usd);
    const isPreventa = item.is_preventa && product.preventa_enabled;
    const preventaAmount = isPreventa ? Math.round(priceUsd * (product.preventa_percent / 100) * 100) / 100 : null;

    enrichedItems.push({
      id: uuid(), product_id: item.product_id, product_title: product.title,
      product_image: null, quantity: item.quantity, price_usd: priceUsd,
      supplier_url: product.supplier_url, is_preventa: isPreventa,
      preventa_amount_paid: preventaAmount ?? undefined,
      preventa_remaining: preventaAmount ? Math.round((priceUsd - preventaAmount) * 100) / 100 : undefined,
    });
    subtotalUsd += isPreventa ? (preventaAmount! * item.quantity) : (priceUsd * item.quantity);
  }

  if (coupon) {
    if (coupon.type === 'percentage') discountUsd = Math.round(subtotalUsd * (coupon.value / 100) * 100) / 100;
    else if (coupon.type === 'fixed') discountUsd = Math.min(parseFloat(coupon.value), subtotalUsd);
  }

  const zone: ShippingZone = shipping_zone || (shipping_address.country_code === 'CO' ? 'colombia' : 'international');
  const shippingUsd = coupon?.type === 'free_shipping' ? 0 : await getShippingRate(zone);
  const totalUsd = Math.max(0, subtotalUsd + shippingUsd - discountUsd);
  const totalCop = await usdToCop(totalUsd);

  const year = new Date().getFullYear();
  const countRes = await query(`SELECT COUNT(*) as c FROM orders WHERE created_at >= '${year}-01-01'`);
  const count = parseInt(countRes.rows[0].c) + 1;
  const orderNumber = `LTC-${year}-${String(count).padStart(6, '0')}`;
  const orderId = uuid();

  await query(`
    INSERT INTO orders (id, order_number, status, customer_name, customer_email, customer_phone, customer_country,
      shipping_line1, shipping_line2, shipping_city, shipping_state, shipping_postal,
      shipping_country, shipping_country_code, shipping_zone,
      subtotal_usd, shipping_usd, discount_usd, total_usd, total_cop, coupon_code)
    VALUES ($1,$2,'pending',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
  `, [
    orderId, orderNumber, customer.name, customer.email, customer.phone || null, customer.country || 'CO',
    shipping_address.line1, shipping_address.line2 || null, shipping_address.city,
    shipping_address.state || null, shipping_address.postal_code || null,
    shipping_address.country, shipping_address.country_code || 'CO', zone,
    subtotalUsd, shippingUsd, discountUsd, totalUsd, totalCop, coupon_code || null,
  ]);

  for (const item of enrichedItems) {
    await query(`INSERT INTO order_items (id, order_id, product_id, product_title, product_image, quantity, price_usd, supplier_url, is_preventa, preventa_amount_paid, preventa_remaining) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [item.id, orderId, item.product_id, item.product_title, item.product_image || null, item.quantity, item.price_usd, item.supplier_url || null, item.is_preventa, item.preventa_amount_paid || null, item.preventa_remaining || null]);
  }

  for (const item of items) {
    await query('UPDATE products SET stock = GREATEST(0, stock - $1) WHERE id = $2 AND stock > 0', [item.quantity, item.product_id]);
  }
  if (coupon) await query('UPDATE coupons SET uses_count = uses_count + 1 WHERE id = $1', [coupon.id]);

  const orderRow = await query('SELECT * FROM orders WHERE id = $1', [orderId]);
  const order = await parseOrder(orderRow.rows[0]);

  let paymentPreference = null;
  try { paymentPreference = await createPaymentPreference(order); } catch (e) { console.error('MP error:', e); }

  sendOrderConfirmation(order).catch(e => console.error('Email error:', e));

  return NextResponse.json({ success: true, data: { order_id: orderId, order_number: orderNumber, total_usd: totalUsd, total_cop: totalCop, payment_preference_id: paymentPreference?.id, payment_init_point: (paymentPreference as any)?.init_point } }, { status: 201 });
}

export async function parseOrder(row: any): Promise<Order> {
  const itemsRes = await query('SELECT * FROM order_items WHERE order_id = $1', [row.id]);
  return {
    id: row.id, order_number: row.order_number, status: row.status,
    customer: { name: row.customer_name, email: row.customer_email, phone: row.customer_phone, country: row.customer_country },
    items: itemsRes.rows.map(i => ({ id: i.id, product_id: i.product_id, product_title: i.product_title, product_image: i.product_image, quantity: i.quantity, price_usd: parseFloat(i.price_usd), supplier_url: i.supplier_url, is_preventa: Boolean(i.is_preventa), preventa_amount_paid: i.preventa_amount_paid ? parseFloat(i.preventa_amount_paid) : undefined, preventa_remaining: i.preventa_remaining ? parseFloat(i.preventa_remaining) : undefined })),
    subtotal_usd: parseFloat(row.subtotal_usd), shipping_usd: parseFloat(row.shipping_usd),
    discount_usd: parseFloat(row.discount_usd), total_usd: parseFloat(row.total_usd), total_cop: row.total_cop,
    shipping_zone: row.shipping_zone,
    shipping_address: { line1: row.shipping_line1, line2: row.shipping_line2, city: row.shipping_city, state: row.shipping_state, postal_code: row.shipping_postal, country: row.shipping_country, country_code: row.shipping_country_code },
    coupon_code: row.coupon_code, payment_id: row.payment_id,
    tracking_number: row.tracking_number, tracking_carrier: row.tracking_carrier, tracking_notified_at: row.tracking_notified_at,
    created_at: row.created_at, updated_at: row.updated_at,
  };
}
