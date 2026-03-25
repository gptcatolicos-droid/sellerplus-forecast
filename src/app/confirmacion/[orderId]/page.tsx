export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import Link from 'next/link';
import { query, ensureInit } from '@/lib/db';

export const metadata: Metadata = { title: 'Pedido Confirmado | La Tienda de Comics' };

async function getOrder(orderId: string) {
  try {
    await ensureInit();
    const r = await query('SELECT * FROM orders WHERE id = $1 OR order_number = $1', [orderId]);
    if (!r.rows[0]) return null;
    const order = r.rows[0];
    const items = await query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
    return { ...order, items: items.rows };
  } catch { return null; }
}

export default async function ConfirmacionPage({ params, searchParams }: {
  params: { orderId: string };
  searchParams: { status?: string; payment_id?: string };
}) {
  await ensureInit();
  const order = await getOrder(params.orderId);
  const paymentStatus = searchParams.status;
  const isFailed = paymentStatus === 'failure' || paymentStatus === 'rejected';
  const isPending = paymentStatus === 'pending';

  if (!order) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white' }}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Pedido no encontrado</h1>
          <p style={{ color: '#999', marginBottom: 24 }}>El número de pedido no existe o expiró.</p>
          <Link href="/" style={{ background: '#CC0000', color: 'white', padding: '12px 24px', borderRadius: 12, textDecoration: 'none', fontWeight: 700 }}>
            Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>
          {isFailed ? '❌' : isPending ? '⏳' : '✅'}
        </div>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 32, fontWeight: 700, letterSpacing: '.02em', marginBottom: 8 }}>
          {isFailed ? 'PAGO FALLIDO' : isPending ? 'PAGO PENDIENTE' : '¡PEDIDO CONFIRMADO!'}
        </h1>
        <p style={{ fontSize: 14, color: '#999', marginBottom: 28 }}>
          {isFailed ? 'Hubo un problema con tu pago. Intenta de nuevo.' :
           isPending ? 'Tu pago está siendo procesado.' :
           `Confirmación enviada a ${order.customer_email}`}
        </p>

        <div style={{ background: '#F7F7F7', border: '1px solid #E8E8E8', borderRadius: 16, padding: 20, textAlign: 'left', marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>Número de pedido</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>{order.order_number}</div>

          {order.items?.map((item: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #E8E8E8', fontSize: 13 }}>
              <span style={{ color: '#555' }}>{item.product_title} × {item.quantity}</span>
              <span>${parseFloat(item.price_usd).toFixed(2)}</span>
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, color: '#999' }}>
            <span>Envío</span><span>${parseFloat(order.shipping_usd).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 700, paddingTop: 12, borderTop: '1.5px solid #E8E8E8', marginTop: 8 }}>
            <span>Total</span>
            <span style={{ color: '#CC0000' }}>${parseFloat(order.total_usd).toFixed(2)} USD</span>
          </div>
        </div>

        {!isFailed && (
          <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: 14, textAlign: 'left', marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9a3412', marginBottom: 8 }}>📧 ¿Qué sigue?</div>
            <div style={{ fontSize: 12, color: '#c2410c', lineHeight: 1.7 }}>
              1. Recibirás un email con los detalles del pedido.<br />
              2. Te notificamos cuando despachemos con tu número de tracking.<br />
              3. Tiempo estimado: {order.shipping_zone === 'colombia' ? '6–10' : '8–15'} días hábiles.
            </div>
          </div>
        )}

        <Link href="/" style={{
          display: 'block', width: '100%', padding: 14,
          background: isFailed ? '#CC0000' : '#0D0D0D',
          color: 'white', textDecoration: 'none',
          fontSize: 14, fontWeight: 700, borderRadius: 12, textAlign: 'center',
        }}>
          {isFailed ? 'Intentar de nuevo →' : 'Seguir buscando →'}
        </Link>
      </div>
    </main>
  );
}
