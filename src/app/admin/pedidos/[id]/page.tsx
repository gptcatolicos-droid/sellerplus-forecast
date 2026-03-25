'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente', color: '#ea580c' },
  { value: 'processing', label: 'Procesando', color: '#2563eb' },
  { value: 'shipped', label: 'Despachado', color: '#7c3aed' },
  { value: 'delivered', label: 'Entregado', color: '#16a34a' },
  { value: 'cancelled', label: 'Cancelado', color: '#CC0000' },
];

const SUPPLIER_LABELS: Record<string, string> = {
  midtown: 'Midtown Comics', iron_studios: 'Iron Studios',
  panini: 'Panini Colombia', amazon: 'Amazon',
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState('');
  const [carrier, setCarrier] = useState('USPS');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/orders/${params.id}`)
      .then(r => r.json())
      .then(d => { if (d.success) setOrder(d.data); })
      .finally(() => setLoading(false));
  }, [params.id]);

  const updateStatus = async (status: string) => {
    await fetch(`/api/orders/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setOrder((o: any) => ({ ...o, status }));
  };

  const saveTracking = async () => {
    if (!tracking) return;
    setSaving(true);
    await fetch(`/api/orders/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tracking_number: tracking, tracking_carrier: carrier }),
    });
    setSaving(false); setSaved(true);
    setOrder((o: any) => ({ ...o, tracking_number: tracking, tracking_carrier: carrier, status: 'shipped' }));
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Cargando pedido...</div>;
  if (!order) return <div style={{ padding: 40, textAlign: 'center', color: '#CC0000' }}>Pedido no encontrado</div>;

  const statusInfo = STATUS_OPTIONS.find(s => s.value === order.status) || STATUS_OPTIONS[0];
  const profit = order.items?.reduce((s: number, i: any) => {
    const margin = parseFloat(i.price_usd) * 0.2;
    return s + margin * i.quantity;
  }, 0);

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: 13, marginBottom: 8, padding: 0 }}>← Volver</button>
          <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: 'Oswald, sans-serif', letterSpacing: '.02em' }}>{order.order_number}</h1>
          <p style={{ fontSize: 13, color: '#999', marginTop: 2 }}>
            {new Date(order.created_at).toLocaleDateString('es-CO', { dateStyle: 'long' })}
            {order.items?.some((i: any) => i.supplier_url?.includes('midtown') || i.supplier_url?.includes('iron') || i.supplier_url?.includes('amazon'))
              ? ' · 🤖 Generado por IA' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={order.status} onChange={e => updateStatus(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: `2px solid ${statusInfo.color}`, background: 'white', fontSize: 13, fontFamily: 'inherit', color: statusInfo.color, fontWeight: 700, cursor: 'pointer' }}>
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* ⭐ BUY LINKS — La clave del dropshipping */}
      {order.items?.some((i: any) => i.supplier_url) && (
        <div style={{ background: '#fff7ed', border: '2px solid #f97316', borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#9a3412', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
            🛒 TU LISTA DE COMPRA — Compra aquí y envía al cliente
          </div>
          {order.items?.filter((i: any) => i.supplier_url).map((item: any, idx: number) => {
            const costEst = parseFloat(item.price_usd) / 1.25;
            const gain = parseFloat(item.price_usd) - costEst;
            return (
              <div key={idx} style={{ background: 'white', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 3 }}>{item.product_title}</div>
                  <div style={{ fontSize: 12, color: '#86868b' }}>
                    Costo estimado: ~${costEst.toFixed(2)} · Cobrado: ${parseFloat(item.price_usd).toFixed(2)}
                    <span style={{ color: '#16a34a', fontWeight: 700, marginLeft: 8 }}>+${gain.toFixed(2)} de ganancia</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#86868b', marginTop: 3 }}>
                    📦 Enviar a: {order.customer?.name} · {order.shipping_address?.line1}, {order.shipping_address?.city}
                  </div>
                </div>
                <a href={item.supplier_url} target="_blank" rel="noopener noreferrer" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: '#CC0000', color: 'white', fontSize: 12, fontWeight: 800,
                  padding: '9px 16px', borderRadius: 9, textDecoration: 'none',
                  textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Comprar →
                </a>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Customer */}
        <div style={{ background: 'white', border: '1px solid #E8E8E8', borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Cliente</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{order.customer?.name}</div>
          <div style={{ fontSize: 13, color: '#555', marginTop: 4, lineHeight: 1.6 }}>
            {order.customer?.email}<br />
            {order.customer?.phone}<br />
            {order.customer?.country}
          </div>
        </div>

        {/* Shipping */}
        <div style={{ background: 'white', border: '1px solid #E8E8E8', borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Dirección de envío</div>
          <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>
            {order.shipping_address?.line1}<br />
            {order.shipping_address?.city}, {order.shipping_address?.country}<br />
            Zona: {order.shipping_zone === 'colombia' ? '🇨🇴 Colombia ($5)' : '🌎 Internacional ($30)'}
          </div>
        </div>
      </div>

      {/* Tracking */}
      <div style={{ background: 'white', border: '1px solid #E8E8E8', borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
          Número de tracking
          {order.tracking_number && <span style={{ fontSize: 11, fontWeight: 400, color: '#16a34a', marginLeft: 8 }}>✓ {order.tracking_number}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={carrier} onChange={e => setCarrier(e.target.value)}
            style={{ padding: '10px 12px', border: '1.5px solid #E8E8E8', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, background: '#F7F7F7', outline: 'none' }}>
            {['USPS', 'DHL', 'FedEx', 'UPS', 'Servientrega', 'Coordinadora'].map(c => <option key={c}>{c}</option>)}
          </select>
          <input value={tracking} onChange={e => setTracking(e.target.value)}
            placeholder="Ej: 9400111899223456789012"
            style={{ flex: 1, padding: '10px 13px', border: '1.5px solid #E8E8E8', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none' }}
          />
          <button onClick={saveTracking} disabled={saving || !tracking}
            style={{ padding: '10px 18px', background: saved ? '#16a34a' : '#0D0D0D', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
            {saved ? '✓ Guardado' : saving ? '...' : 'Guardar y notificar'}
          </button>
        </div>
        <p style={{ fontSize: 11, color: '#999', marginTop: 6 }}>Al guardar se envía email automático al cliente con el tracking.</p>
      </div>

      {/* Financials */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {[
          { l: 'Total cobrado', v: `$${parseFloat(order.total_usd).toFixed(2)} USD`, c: '#CC0000' },
          { l: 'Envío cobrado', v: `$${parseFloat(order.shipping_usd || 0).toFixed(2)} USD`, c: '#555' },
          { l: 'Costo estimado', v: `~$${(parseFloat(order.subtotal_usd) / 1.25).toFixed(2)} USD`, c: '#555' },
          { l: 'Ganancia estimada', v: `+$${profit?.toFixed(2) || '0.00'} USD`, c: '#16a34a' },
        ].map(stat => (
          <div key={stat.l} style={{ background: 'white', border: '1px solid #E8E8E8', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{stat.l}</div>
            <div style={{ fontSize: 20, fontWeight: 300, color: stat.c }}>{stat.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
