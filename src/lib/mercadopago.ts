import MercadoPago, { Payment, Preference } from 'mercadopago';
import type { Order } from '@/types';

const client = new MercadoPago({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://latiendadecomics.com';

// ── CREATE PREFERENCE ─────────────────────────
export async function createPaymentPreference(order: Order) {
  const preference = new Preference(client);

  const items = order.items.map(item => ({
    id: item.product_id,
    title: item.is_preventa
      ? `${item.product_title} (Preventa 30%)`
      : item.product_title,
    quantity: item.quantity,
    unit_price: item.is_preventa
      ? Number(item.preventa_amount_paid?.toFixed(2) || 0)
      : Number(item.price_usd.toFixed(2)),
    currency_id: 'USD',
    picture_url: item.product_image || `${SITE_URL}/images/placeholder.jpg`,
  }));

  // Add shipping as a line item
  if (order.shipping_usd > 0) {
    items.push({
      id: 'shipping',
      title: `Envío ${order.shipping_zone === 'colombia' ? 'Colombia' : 'Internacional'}`,
      quantity: 1,
      unit_price: Number(order.shipping_usd.toFixed(2)),
      currency_id: 'USD',
      picture_url: '',
    });
  }

  const result = await preference.create({
    body: {
      items,
      payer: {
        name: order.customer.name,
        email: order.customer.email,
        phone: order.customer.phone ? { number: order.customer.phone } : undefined,
        address: {
          street_name: order.shipping_address.line1,
          city_name: order.shipping_address.city,
          zip_code: order.shipping_address.postal_code || '',
        },
      },
      external_reference: order.id,
      back_urls: {
        success: `${SITE_URL}/confirmacion/${order.id}?status=success`,
        failure: `${SITE_URL}/checkout?status=failed`,
        pending: `${SITE_URL}/confirmacion/${order.id}?status=pending`,
      },
      auto_return: 'approved',
      notification_url: `${SITE_URL}/api/payments/webhook`,
      metadata: {
        order_id: order.id,
        order_number: order.order_number,
      },
    },
  });

  return result;
}

// ── VERIFY WEBHOOK ────────────────────────────
export function verifyWebhookSignature(
  body: string,
  signature: string | null,
  requestId: string | null
): boolean {
  // MercadoPago HMAC-SHA256 verification
  if (!signature || !requestId || !process.env.MP_WEBHOOK_SECRET) {
    return process.env.NODE_ENV === 'development'; // Allow in dev
  }

  const crypto = require('crypto');
  const manifest = `id:${requestId};request-id:${requestId};ts:${Date.now()};`;
  const expected = crypto
    .createHmac('sha256', process.env.MP_WEBHOOK_SECRET)
    .update(manifest)
    .digest('hex');

  return signature.includes(expected);
}

// ── GET PAYMENT STATUS ────────────────────────
export async function getPaymentStatus(paymentId: string) {
  const payment = new Payment(client);
  return payment.get({ id: paymentId });
}
