'use client';
import { useEffect, useState } from 'react';

interface Props {
  orderId: string | null;
  onContinue: () => void;
}

export default function ConfirmPage({ orderId, onContinue }: Props) {
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    if (orderId) {
      fetch(`/api/orders/${orderId}`)
        .then(r => r.json())
        .then(d => { if (d.success) setOrder(d.data); })
        .catch(() => {});
    }
  }, [orderId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'white', padding: '40px 24px', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
      <span style={{ fontSize: 64, display: 'block', marginBottom: 16 }}>✅</span>
      <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 32, fontWeight: 700, letterSpacing: '0.02em', marginBottom: 8 }}>¡PEDIDO CONFIRMADO!</h1>
      <p style={{ fontSize: 14, color: '#999', marginBottom: 28 }}>
        Confirmación enviada a tu email
      </p>

      {order && (
        <div style={{ background: '#f7f7f7', border: '1px solid #e8e8e8', borderRadius: 16, padding: 20, textAlign: 'left', width: '100%', marginBottom: 16 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Número de pedido</p>
          <p style={{ fontSize: 20, fontWeight: 700, marginBottom: 14 }}>{order.order_number}</p>
          {order.items?.map((item: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e8e8e8', fontSize: 13 }}>
              <span style={{ color: '#555' }}>{item.product_title} × {item.quantity}</span>
              <span>${(item.price_usd * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, paddingTop: 12 }}>
            <span>Total pagado</span>
            <span style={{ color: '#CC0000' }}>${order.total_usd?.toFixed(2)} USD</span>
          </div>
        </div>
      )}

      <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: 14, textAlign: 'left', width: '100%', marginBottom: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#9a3412', marginBottom: 7 }}>📧 ¿Qué sigue?</p>
        <p style={{ fontSize: 12, color: '#c2410c', lineHeight: 1.7 }}>
          1. Recibirás un email con todos los detalles.<br />
          2. Te notificamos cuando despachemos con tracking.<br />
          3. Entrega estimada: 6–10 días hábiles.
        </p>
      </div>

      <button
        onClick={onContinue}
        style={{ width: '100%', padding: 14, background: '#0d0d0d', border: 'none', color: 'white', fontSize: 14, fontWeight: 700, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit' }}
      >
        Seguir buscando →
      </button>
    </div>
  );
}
