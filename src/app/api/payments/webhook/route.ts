import { NextRequest, NextResponse } from 'next/server';
import { query, ensureInit } from '@/lib/db';
import { getPaymentStatus } from '@/lib/mercadopago';
import { sendOrderConfirmation } from '@/lib/email';

export async function POST(req: NextRequest) {
  await ensureInit();
  try {
    const body = await req.json();
    const { type, data } = body;

    if (type !== 'payment') {
      return NextResponse.json({ received: true });
    }

    const paymentId = data?.id;
    if (!paymentId) return NextResponse.json({ received: true });

    const payment = await getPaymentStatus(paymentId);
    if (!payment) return NextResponse.json({ received: true });

    const externalRef = payment.external_reference;
    if (!externalRef) return NextResponse.json({ received: true });

    const orderRes = await query('SELECT * FROM orders WHERE id = $1', [externalRef]);
    if (!orderRes.rows.length) return NextResponse.json({ received: true });

    const order = orderRes.rows[0];
    const status = payment.status;

    let newStatus = order.status;
    if (status === 'approved') newStatus = 'processing';
    else if (status === 'rejected' || status === 'cancelled') newStatus = 'cancelled';
    else if (status === 'pending' || status === 'in_process') newStatus = 'pending';

    await query(
      'UPDATE orders SET status = $1, payment_id = $2, payment_method = $3, updated_at = NOW() WHERE id = $4',
      [newStatus, String(paymentId), payment.payment_type_id || 'mercadopago', externalRef]
    );

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ received: true });
  }
}
