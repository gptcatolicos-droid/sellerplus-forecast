'use client';
import { useState, useEffect } from 'react';
import { useCart } from '@/hooks/useCart';

interface ProductDrawerProps {
  product: any | null;
  onClose: () => void;
}

export default function ProductDrawer({ product, onClose }: ProductDrawerProps) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatResponse, setChatResponse] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const { addItem } = useCart();

  const isOpen = !!product;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setQty(1);
      setAdded(false);
      setChatResponse('');
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!product) return null;

  const isAffiliate = product.model === 'affiliate';
  const copPrice = product.price_cop || Math.round(product.price_usd * 4100);

  async function askProduct() {
    if (!chatInput.trim() || chatLoading) return;
    setChatLoading(true);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat_product',
          product: { title: product.title, description: product.title, price: `$${product.price_usd}` },
          message: chatInput,
        }),
      });
      const data = await res.json();
      setChatResponse(data.data?.text || '');
      setChatInput('');
    } catch {
      setChatResponse('Error al consultar. Intenta de nuevo.');
    } finally {
      setChatLoading(false);
    }
  }

  function handleAddCart() {
    addItem({
      id: product.id,
      title: product.title,
      price_usd: product.price_usd,
      image: product.image,
      supplier: product.supplier,
      supplier_url: product.supplier_url,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)',
          zIndex: 100, animation: 'fadeIn .2s ease',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%',
        transform: 'translateX(-50%)',
        width: '100%', maxWidth: 640,
        background: '#fff', borderRadius: '20px 20px 0 0',
        boxShadow: '0 -8px 40px rgba(0,0,0,.18)',
        zIndex: 101, maxHeight: '88vh', overflowY: 'auto',
        paddingBottom: 32, animation: 'slideUp .32s cubic-bezier(.32,.72,0,1)',
      }}>
        {/* Handle */}
        <div style={{ width: 40, height: 4, background: '#E0E0E0', borderRadius: 2, margin: '12px auto 0' }} />

        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            width: 32, height: 32, borderRadius: '50%',
            background: '#F7F7F7', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, color: '#555',
          }}
        >✕</button>

        <div style={{ padding: '20px 20px 0' }}>
          {/* Category */}
          <div style={{ fontSize: 10, fontWeight: 800, color: '#CC0000', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>
            {product.supplier_name} · {product.model === 'affiliate' ? 'Afiliado Amazon' : 'Dropshipping'}
          </div>

          {/* Title */}
          <h2 style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.1, letterSpacing: '.01em', marginBottom: 6, fontFamily: "'Oswald', sans-serif" }}>
            {product.title}
          </h2>

          {/* AI pill */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d',
            fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, marginBottom: 14,
          }}>
            ✦ Encontrado por IA en tiempo real
          </div>

          {/* Image */}
          <div style={{
            aspectRatio: '16/9', background: '#F7F7F7', borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 14, border: '1px solid #E8E8E8', overflow: 'hidden',
          }}>
            {product.image ? (
              <img src={product.image} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: 64 }}>📚</span>
            )}
          </div>

          {/* Price */}
          <div style={{ background: '#F7F7F7', borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
              <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.03em' }}>${product.price_usd.toFixed(2)}</span>
              <span style={{ fontSize: 14, color: '#999' }}>USD</span>
              {!isAffiliate && (
                <span style={{ fontSize: 10, fontWeight: 700, background: '#fef9c3', border: '1px solid #fde68a', color: '#854d0e', padding: '2px 7px', borderRadius: 20 }}>+25% margen</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>≈ ${copPrice.toLocaleString('es-CO')} COP</div>
            {!isAffiliate && <div style={{ fontSize: 11, color: '#15803d', fontWeight: 600 }}>🚚 Envío Colombia: $5 · Internacional: $30</div>}
          </div>

          {/* Delivery */}
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 20 }}>📦</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1e3a5f' }}>{product.delivery_days} días hábiles</div>
              <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 1 }}>
                {product.supplier_name} → {product.supplier === 'amazon' ? 'Amazon Prime' : 'USPS/DHL'} → Tu dirección
              </div>
            </div>
          </div>

          {/* QTY — only for dropshipping */}
          {!isAffiliate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '.05em' }}>Cantidad</span>
              <div style={{ display: 'inline-flex', border: '2px solid #0D0D0D', borderRadius: 9, overflow: 'hidden' }}>
                <button onClick={() => setQty(q => Math.max(1, q - 1))}
                  style={{ width: 38, height: 38, background: '#fff', border: 'none', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                <span style={{ width: 44, textAlign: 'center', fontSize: 15, fontWeight: 700, lineHeight: '38px' }}>{qty}</span>
                <button onClick={() => setQty(q => q + 1)}
                  style={{ width: 38, height: 38, background: '#fff', border: 'none', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>✓ Disponible</span>
            </div>
          )}

          {/* CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 14 }}>
            {isAffiliate ? (
              <>
                {/* Affiliate: two buttons */}
                <a
                  href={product.affiliate_url || product.supplier_url}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    width: '100%', padding: 15, background: '#f97316', border: 'none',
                    color: 'white', fontSize: 14, fontWeight: 700, borderRadius: 12,
                    textAlign: 'center', textDecoration: 'none', display: 'block',
                    fontFamily: 'inherit',
                  }}
                >
                  Ver en Amazon →
                </a>
                <button
                  onClick={() => { /* handle dropshipping order */ }}
                  style={{
                    width: '100%', padding: 15, background: '#fff',
                    border: '2px solid #0D0D0D', color: '#0D0D0D',
                    fontSize: 14, fontWeight: 700, borderRadius: 12,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Comprar con nosotros (+25%)
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => window.location.href = '/checkout'}
                  style={{
                    width: '100%', padding: 15, background: '#CC0000', border: 'none',
                    color: 'white', fontSize: 15, fontWeight: 700, borderRadius: 12,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Comprar ahora →
                </button>
                <button
                  onClick={handleAddCart}
                  style={{
                    width: '100%', padding: 15, background: added ? '#0D0D0D' : '#fff',
                    border: '2px solid #0D0D0D', color: added ? 'white' : '#0D0D0D',
                    fontSize: 15, fontWeight: 700, borderRadius: 12,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s',
                  }}
                >
                  {added ? '✓ Agregado al carrito' : '+ Agregar al carrito'}
                </button>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', fontSize: 11, color: '#999', flexWrap: 'wrap', marginBottom: 20 }}>
            <span>🔒 Pago seguro</span>
            <span>🏦 MercadoPago</span>
            <span>📦 Envío garantizado</span>
          </div>

          {/* Product chat - Claude */}
          <div style={{ background: '#F7F7F7', border: '1px solid #E8E8E8', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ background: '#0D0D0D', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#CC0000', animation: 'blink 2s infinite' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'white', letterSpacing: '.03em' }}>Pregunta sobre este producto</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginLeft: 'auto' }}>Claude</span>
            </div>
            {chatResponse && (
              <div style={{ padding: '12px 14px', fontSize: 13, color: '#555', lineHeight: 1.6, borderBottom: '1px solid #E8E8E8' }}>
                {chatResponse}
              </div>
            )}
            {!chatResponse && (
              <div style={{ padding: '12px 14px', fontSize: 12, color: '#999', fontStyle: 'italic', borderBottom: '1px solid #E8E8E8' }}>
                "¿Es buena para alguien nuevo? ¿Qué leer después?"
              </div>
            )}
            <div style={{ display: 'flex', gap: 7, padding: '9px 12px' }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && askProduct()}
                placeholder="Escribe tu pregunta..."
                style={{
                  flex: 1, background: '#fff', border: '1px solid #E8E8E8',
                  borderRadius: 7, padding: '8px 11px', fontSize: 13,
                  fontFamily: 'inherit', outline: 'none',
                }}
              />
              <button
                onClick={askProduct}
                disabled={chatLoading}
                style={{
                  padding: '8px 14px', background: '#CC0000', border: 'none',
                  borderRadius: 7, color: 'white', fontSize: 12, fontWeight: 700,
                  fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                {chatLoading ? '...' : '→'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{transform:translateX(-50%) translateY(100%)} to{transform:translateX(-50%) translateY(0)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.2} }
      `}</style>
    </>
  );
}
