'use client';
import { useState, useEffect } from 'react';
import { useCart } from '@/hooks/useCart';
import Image from 'next/image';

const COUNTRIES = [
  { code: 'CO', name: 'Colombia 🇨🇴', zone: 'colombia' },
  { code: 'MX', name: 'México 🇲🇽', zone: 'international' },
  { code: 'AR', name: 'Argentina 🇦🇷', zone: 'international' },
  { code: 'CL', name: 'Chile 🇨🇱', zone: 'international' },
  { code: 'PE', name: 'Perú 🇵🇪', zone: 'international' },
  { code: 'EC', name: 'Ecuador 🇪🇨', zone: 'international' },
  { code: 'VE', name: 'Venezuela 🇻🇪', zone: 'international' },
  { code: 'US', name: 'Estados Unidos 🇺🇸', zone: 'international' },
  { code: 'OTHER', name: 'Otro país 🌎', zone: 'international' },
];

export default function CheckoutPage() {
  const [step, setStep] = useState(2);
  const [cart, setCart] = useState<any[]>([]);
  const [country, setCountry] = useState('CO');
  const [coupon, setCoupon] = useState('');
  const [couponApplied, setCouponApplied] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Save email for abandoned cart recovery
  const { setCustomerEmail, clearCart } = useCart();
  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    line1: '', city: '', postal: '',
  });

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('ltc_cart') || '[]');
    setCart(stored);
  }, []);

  const zone = COUNTRIES.find(c => c.code === country)?.zone || 'colombia';
  const shippingUsd = zone === 'colombia' ? 5 : 30;
  const subtotal = cart.reduce((s, i) => s + i.price_usd * i.quantity, 0);
  const discount = couponApplied
    ? couponApplied.type === 'percentage' ? subtotal * (couponApplied.value / 100)
    : couponApplied.type === 'fixed' ? Math.min(couponApplied.value, subtotal)
    : couponApplied.type === 'free_shipping' ? shippingUsd : 0
    : 0;
  const total = Math.max(0, subtotal + shippingUsd - discount);
  const totalCop = Math.round(total * 4100);

  const applyCoupon = async () => {
    setCouponError('');
    if (!coupon.trim()) return;
    try {
      const r = await fetch(`/api/coupons?code=${coupon.toUpperCase()}`);
      const data = await r.json();
      if (data.success) { setCouponApplied(data.data); setCouponError(''); }
      else setCouponError('Cupón no válido o expirado');
    } catch { setCouponError('Error al validar el cupón'); }
  };

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.line1 || !form.city) {
      setError('Por favor completa todos los campos obligatorios');
      return;
    }
    setLoading(true); setError('');
    try {
      const selectedCountry = COUNTRIES.find(c => c.code === country)!;
      const r = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: { name: form.name, email: form.email, phone: form.phone, country },
          shipping_address: {
            line1: form.line1, city: form.city, postal_code: form.postal,
            country: selectedCountry.name, country_code: country,
          },
          items: cart.map(i => ({ product_id: i.id, quantity: i.quantity, is_preventa: false })),
          coupon_code: couponApplied?.code || null,
          shipping_zone: zone,
        }),
      });
      const data = await r.json();
      if (!data.success) { setError(data.error || 'Error al crear el pedido'); return; }
      // Redirect to MercadoPago
      if (data.data.payment_init_point) {
        window.location.href = data.data.payment_init_point;
      } else {
        clearCart();
        if (typeof window !== 'undefined' && (window as any).trackPurchase) {
          (window as any).trackPurchase({ order_number: data.data.order_number, total_usd: data.data.total_usd });
        }
        window.location.href = `/confirmacion/${data.data.order_id}`;
      }
    } catch (e: any) {
      setError('Error de conexión. Por favor intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const inp = (field: string) => ({
    value: (form as any)[field],
    onChange: (e: any) => setForm(prev => ({ ...prev, [field]: e.target.value })),
    style: {
      width: '100%', background: '#F7F7F7', border: '1.5px solid #E8E8E8',
      borderRadius: 10, padding: '11px 13px', fontSize: 14,
      fontFamily: 'inherit', outline: 'none', color: '#111',
    },
  });

  if (cart.length === 0) return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white' }}>
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🛒</div>
        <h2 style={{ marginBottom: 16 }}>Tu carrito está vacío</h2>
        <a href="/" style={{ background: '#CC0000', color: 'white', padding: '12px 24px', borderRadius: 12, textDecoration: 'none', fontWeight: 700 }}>
          Buscar productos →
        </a>
      </div>
    </main>
  );

  return (
    <main style={{ minHeight: '100vh', background: '#F7F7F7' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #E8E8E8', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <a href="/" style={{ color: '#555', fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          ← Volver
        </a>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <img src="/logo.webp" alt="La Tienda de Comics" style={{ height: 28, objectFit: 'contain', margin: '0 auto' }} />
        </div>
        <div style={{ width: 60 }} />
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', background: 'white', borderBottom: '1px solid #E8E8E8' }}>
        {['Producto', 'Datos', 'Pago'].map((s, i) => (
          <div key={s} style={{
            flex: 1, padding: '10px 4px', textAlign: 'center',
            fontSize: 11, fontWeight: 700,
            color: i + 1 === step ? '#111' : i + 1 < step ? '#CC0000' : '#999',
            borderBottom: `2px solid ${i + 1 === step ? '#0D0D0D' : i + 1 < step ? '#CC0000' : 'transparent'}`,
          }}>{s}</div>
        ))}
      </div>

      <div style={{ maxWidth: 580, margin: '0 auto', padding: '16px 16px 80px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Order summary */}
        <div style={{ background: 'white', border: '1px solid #E8E8E8', borderRadius: 14, padding: 14 }}>
          {cart.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', paddingBottom: i < cart.length - 1 ? 12 : 0, marginBottom: i < cart.length - 1 ? 12 : 0, borderBottom: i < cart.length - 1 ? '1px solid #F0F0F0' : 'none' }}>
              <div style={{ width: 44, height: 60, background: '#F7F7F7', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, overflow: 'hidden' }}>
                {item.image_url ? <img src={item.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : '📚'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{item.title?.slice(0, 45)}</div>
                <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>✦ IA · {item.supplier}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#CC0000', marginTop: 4 }}>${item.price_usd?.toFixed(2)} USD</div>
              </div>
              <div style={{ fontSize: 12, color: '#999' }}>× {item.quantity}</div>
            </div>
          ))}
        </div>

        {/* Contact */}
        <div style={{ background: 'white', border: '1px solid #E8E8E8', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Datos de contacto</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Nombre *</label>
              <input {...inp('name')} placeholder="Juan García" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Celular</label>
              <input {...inp('phone')} placeholder="+57 300..." />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Email *</label>
            <input {...inp('email')} type="email" placeholder="tu@email.com" />
          </div>
        </div>

        {/* Address */}
        <div style={{ background: 'white', border: '1px solid #E8E8E8', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Dirección de envío</div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>País *</label>
            <select value={country} onChange={e => setCountry(e.target.value)}
              style={{ width: '100%', background: '#F7F7F7', border: '1.5px solid #E8E8E8', borderRadius: 10, padding: '11px 13px', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Dirección *</label>
            <input {...inp('line1')} placeholder="Calle 45 #23-10, Apto 302" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Ciudad *</label>
              <input {...inp('city')} placeholder="Bogotá" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Código postal</label>
              <input {...inp('postal')} placeholder="110111" />
            </div>
          </div>
        </div>

        {/* Shipping */}
        <div style={{ background: 'white', border: '1px solid #E8E8E8', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Opción de envío</div>
          {[
            { z: 'colombia', label: '🇨🇴 Colombia', sub: 'USPS → Tu dirección · 6–10 días', price: '$5 USD' },
            { z: 'international', label: '🌎 Internacional', sub: 'USPS Priority · 8–12 días', price: '$30 USD' },
          ].map(opt => (
            <div key={opt.z} onClick={() => {
              const match = COUNTRIES.find(c => c.zone === opt.z && c.code !== 'OTHER');
              if (match) setCountry(match.code);
            }} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: 13,
              border: `1.5px solid ${zone === opt.z ? '#0D0D0D' : '#E8E8E8'}`,
              borderRadius: 11, cursor: 'pointer', marginBottom: 8,
              background: zone === opt.z ? '#F7F7F7' : 'white',
              transition: 'all .15s',
            }}>
              <input type="radio" readOnly checked={zone === opt.z} style={{ accentColor: '#0D0D0D', width: 16, height: 16 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 1 }}>{opt.sub}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{opt.price}</div>
            </div>
          ))}
        </div>

        {/* Coupon */}
        <div style={{ background: 'white', border: '1px solid #E8E8E8', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Cupón de descuento</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={coupon} onChange={e => setCoupon(e.target.value.toUpperCase())}
              placeholder="Ej: COMICS10"
              style={{ flex: 1, background: '#F7F7F7', border: '1.5px solid #E8E8E8', borderRadius: 10, padding: '11px 13px', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
            />
            <button onClick={applyCoupon} style={{ padding: '11px 18px', background: '#0D0D0D', border: 'none', borderRadius: 10, color: 'white', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
              Aplicar
            </button>
          </div>
          {couponError && <p style={{ fontSize: 12, color: '#CC0000', marginTop: 6 }}>{couponError}</p>}
          {couponApplied && <p style={{ fontSize: 12, color: '#15803d', marginTop: 6 }}>✓ Cupón aplicado: -{couponApplied.type === 'percentage' ? `${couponApplied.value}%` : `$${couponApplied.value}`}</p>}
        </div>

        {/* Total */}
        <div style={{ background: 'white', border: '1px solid #E8E8E8', borderRadius: 14, padding: 16 }}>
          {[
            { l: 'Subtotal', v: `$${subtotal.toFixed(2)}` },
            { l: `Envío ${zone === 'colombia' ? 'Colombia' : 'Internacional'}`, v: `$${shippingUsd.toFixed(2)}` },
            ...(discount > 0 ? [{ l: 'Descuento', v: `-$${discount.toFixed(2)}` }] : []),
          ].map(row => (
            <div key={row.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, color: '#999' }}>
              <span>{row.l}</span><span>{row.v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 700, paddingTop: 12, borderTop: '1.5px solid #E8E8E8', marginTop: 8 }}>
            <span>Total</span>
            <span style={{ color: '#CC0000' }}>${total.toFixed(2)} USD</span>
          </div>
          <div style={{ fontSize: 11, color: '#999', textAlign: 'right', marginTop: 4 }}>
            ≈ ${totalCop.toLocaleString('es-CO')} COP
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#fff0f0', border: '1px solid #ffc0c0', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#CC0000' }}>
            {error}
          </div>
        )}

        {/* Pay button */}
        <button onClick={handleSubmit} disabled={loading} style={{
          width: '100%', padding: 17, background: loading ? '#888' : '#CC0000',
          border: 'none', color: 'white', fontSize: 16, fontWeight: 800,
          borderRadius: 14, fontFamily: 'inherit', cursor: loading ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          boxShadow: '0 4px 16px rgba(204,0,0,.28)',
        }}>
          {loading ? 'Procesando...' : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              Pagar ${total.toFixed(2)} con MercadoPago
            </>
          )}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 11, color: '#999' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          Pago 100% seguro · SSL · Datos encriptados
        </div>
      </div>
    </main>
  );
}
