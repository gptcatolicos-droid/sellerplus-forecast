'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useCart } from '@/hooks/useCart';
import toast from 'react-hot-toast';
import CheckoutPage from '@/app/checkout/page';
import ConfirmPage from '@/app/confirmacion/client';

// ── TYPES ─────────────────────────────────────
interface ProductCard {
  title: string;
  price_usd: number;
  price_cop: number;
  price_original: number;
  price_currency: string;
  supplier: string;
  supplier_url: string;
  image_url: string | null;
  in_stock: boolean;
  shipping_time: string;
}

type Message =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; products?: ProductCard[]; searching?: boolean };

const SUPPLIER_LABELS: Record<string, string> = {
  midtown: 'Midtown Comics',
  amazon: 'Amazon',
  ironstudios: 'Iron Studios',
  panini: 'Panini Colombia',
};

const SUPPLIER_COLORS: Record<string, string> = {
  midtown: '#2563eb',
  amazon: '#f59e0b',
  ironstudios: '#7c3aed',
  panini: '#CC0000',
};

const QUICK_CHIPS = [
  'La Muerte de Superman',
  'Naruto Vol. 1',
  'Batman: Year One',
  'Iron Studios Batman',
  'Dark Knight Returns',
  'Funko Pop Spider-Man',
];

// ── SCREEN TYPES ─────────────────────────────
type Screen = 'home' | 'checkout' | 'confirm';

export default function HomeClient() {
  const [screen, setScreen] = useState<Screen>('home');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductCard | null>(null);
  const [qty, setQty] = useState(1);
  const [orderId, setOrderId] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addItem, count } = useCart();

  // Auto-scroll thread
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages]);

  // Send message with streaming
  const sendMessage = useCallback(async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');
    setLoading(true);

    const history = messages.slice(-8).map(m => ({ role: m.role, content: m.content }));
    const userMsg: Message = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);

    // Add AI placeholder
    const aiIndex = messages.length + 1;
    setMessages(prev => [...prev, { role: 'assistant', content: '', searching: false }]);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat', message: msg, history }),
      });

      if (!res.ok) throw new Error('Error en el servidor');
      if (!res.body) throw new Error('No stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'text') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: last.content + parsed.content };
                }
                return updated;
              });
            }

            if (parsed.type === 'searching') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, searching: true };
                }
                return updated;
              });
            }

            if (parsed.type === 'products') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, products: parsed.content, searching: false };
                }
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === 'assistant') {
          updated[updated.length - 1] = { ...last, content: 'Lo siento, hubo un error. Intenta de nuevo.' };
        }
        return updated;
      });
    }

    setLoading(false);
  }, [input, loading, messages]);

  function openProduct(product: ProductCard) {
    setSelectedProduct(product);
    setQty(1);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setTimeout(() => setSelectedProduct(null), 350);
  }

  function handleAddToCart() {
    if (!selectedProduct) return;
    const fakeProduct = {
      id: `live-${selectedProduct.supplier}-${Date.now()}`,
      slug: selectedProduct.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50),
      title: selectedProduct.title,
      description: '',
      price_usd: selectedProduct.price_usd,
      price_cop: selectedProduct.price_cop,
      price_usd_original: selectedProduct.price_original,
      images: selectedProduct.image_url ? [{ id: '1', url: selectedProduct.image_url, alt: selectedProduct.title, is_primary: true, sort_order: 0 }] : [],
      category: 'comics',
      supplier: selectedProduct.supplier as any,
      supplier_url: selectedProduct.supplier_url,
      stock: 99,
      status: 'published' as const,
      preventa_enabled: false,
      preventa_percent: 30,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    addItem(fakeProduct, qty, false);
    toast.success('Agregado al carrito');
    closeDrawer();
  }

  // ── SCREENS ───────────────────────────────────
  if (screen === 'checkout') {
    return <CheckoutPage onBack={() => setScreen('home')} onSuccess={(id) => { setOrderId(id); setScreen('confirm'); }} />;
  }
  if (screen === 'confirm') {
    return <ConfirmPage orderId={orderId} onContinue={() => { setScreen('home'); setMessages([]); }} />;
  }

  return (
    <div className="home-screen">
      {/* ── LOGO ─── */}
      <div className="logo-area">
        <img src="/logo.png" alt="La Tienda de Comics" className="logo-img" />
        <p className="logo-sub">DC · Marvel · Manga · Star Wars · Figuras</p>
      </div>

      {/* ── THREAD ─── */}
      <div className="thread" ref={threadRef}>
        {messages.length === 0 && (
          <div className="intro">
            <h1 className="intro-q">¿En qué cómic, figura<br />o personaje estás<br />interesado?</h1>
            <p className="intro-sub">Escribe o elige una sugerencia</p>
            <div className="chips">
              {QUICK_CHIPS.map(chip => (
                <button key={chip} className="chip" onClick={() => sendMessage(chip)}>{chip}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            {msg.role === 'user' ? (
              <div className="msg-user">
                <div className="bubble-user">{msg.content}</div>
              </div>
            ) : (
              <div className="msg-ai">
                {msg.content && <p className="ai-text" dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />}
                {msg.searching && !msg.products && (
                  <div className="searching-pill">
                    <span className="search-dot" />
                    Buscando en Midtown · Amazon · Iron Studios · Panini...
                  </div>
                )}
                {msg.products && msg.products.length > 0 && (
                  <div className="results-wrap">
                    <div className="results-label">Encontrado en tiempo real</div>
                    <div className="prod-grid">
                      {msg.products.map((p, pi) => (
                        <ProductCardUI key={pi} product={p} onView={() => openProduct(p)} />
                      ))}
                    </div>
                    <button className="see-more-btn">Ver más resultados →</button>
                    <p className="ai-stamp">
                      <span className="ai-dot" />
                      GPT-4o + Claude · Buscado en tiempo real
                    </p>
                  </div>
                )}
                {msg.products && msg.products.length === 0 && (
                  <p className="no-results">No encontramos resultados para esa búsqueda. Prueba con otro título o personaje.</p>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && messages[messages.length - 1]?.role === 'user' && (
          <div className="msg-ai">
            <div className="typing-dots"><span /><span /><span /></div>
          </div>
        )}
      </div>

      {/* ── INPUT ─── */}
      <div className="input-area">
        <div className="input-box">
          <input
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Busca cualquier título, personaje o figura..."
            disabled={loading}
          />
          <button className="send-btn" onClick={() => sendMessage()} disabled={loading || !input.trim()}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── DRAWER OVERLAY ─── */}
      <div className={`drawer-overlay ${drawerOpen ? 'open' : ''}`} onClick={closeDrawer} />

      {/* ── PRODUCT DRAWER ─── */}
      <div className={`drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="drawer-handle" />
        <button className="drawer-close" onClick={closeDrawer}>✕</button>

        {selectedProduct && (
          <div className="drawer-content">
            {/* Image */}
            <div className="drawer-img" style={{ background: 'linear-gradient(135deg, #0d1b35, #1e3a5f)' }}>
              {selectedProduct.image_url ? (
                <img src={selectedProduct.image_url} alt={selectedProduct.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 64 }}>📚</span>
              )}
              <span className="drawer-src-tag">{SUPPLIER_LABELS[selectedProduct.supplier] || selectedProduct.supplier}</span>
            </div>

            {/* Info */}
            <div className="drawer-info">
              <div className="drawer-cat">{selectedProduct.supplier === 'ironstudios' ? 'Figura premium' : selectedProduct.supplier === 'panini' ? 'Cómic en español' : 'DC · Marvel · Comics'}</div>
              <h2 className="drawer-title">{selectedProduct.title}</h2>

              <div className="ai-found-pill">✦ Encontrado por IA en tiempo real</div>

              {/* Price */}
              <div className="price-block">
                <div className="price-main-row">
                  <span className="price-big">${selectedProduct.price_usd.toFixed(2)}</span>
                  <span className="price-cur">USD</span>
                  <span className="price-old">${selectedProduct.price_original.toFixed(2)}</span>
                  <span className="price-tag">+25%</span>
                </div>
                <p className="price-cop">≈ ${selectedProduct.price_cop.toLocaleString('es-CO')} COP</p>
                <p className="price-ship">🚚 Envío Colombia: $5 · Internacional: $30</p>
              </div>

              {/* Delivery */}
              <div className="delivery-box">
                <span style={{ fontSize: 18 }}>📦</span>
                <div>
                  <p className="del-time">{selectedProduct.shipping_time}</p>
                  <p className="del-note">{SUPPLIER_LABELS[selectedProduct.supplier]} → USPS/DHL → Tu dirección</p>
                </div>
              </div>

              {/* Qty */}
              <div className="qty-row">
                <span className="qty-label">Cantidad</span>
                <div className="qty-ctrl">
                  <button className="qty-btn" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
                  <span className="qty-val">{qty}</span>
                  <button className="qty-btn" onClick={() => setQty(q => q + 1)}>+</button>
                </div>
                <span className="stock-ok">✓ Disponible</span>
              </div>

              {/* CTAs */}
              <button className="btn-buy" onClick={() => { handleAddToCart(); setScreen('checkout'); }}>
                Comprar ahora →
              </button>
              <button className="btn-cart-drawer" onClick={handleAddToCart}>
                + Agregar al carrito
              </button>

              <div className="trust-row">
                <span>🔒 Pago seguro</span>
                <span>🏦 MercadoPago</span>
                <span>📦 Envío garantizado</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cart indicator */}
      {count > 0 && (
        <button className="cart-fab" onClick={() => setScreen('checkout')}>
          🛒 {count} en carrito · Ver
        </button>
      )}

      <style jsx>{`
        .home-screen {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background: #fff;
          max-width: 680px;
          margin: 0 auto;
          position: relative;
        }
        .logo-area { text-align: center; padding: 28px 20px 20px; }
        .logo-img { height: 46px; object-fit: contain; }
        .logo-sub { font-size: 12px; color: #999; margin-top: 8px; }
        .thread { flex: 1; overflow-y: auto; padding: 0 16px 16px; display: flex; flex-direction: column; gap: 16px; }
        .intro { text-align: center; padding: 8px 0 20px; }
        .intro-q { font-size: 22px; font-weight: 600; color: #111; line-height: 1.3; letter-spacing: -0.02em; margin-bottom: 8px; }
        .intro-sub { font-size: 13px; color: #999; margin-bottom: 18px; }
        .chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
        .chip { padding: 8px 15px; border-radius: 30px; font-size: 13px; font-weight: 500; background: #f7f7f7; border: 1.5px solid #e8e8e8; color: #555; cursor: pointer; transition: all 0.18s; font-family: inherit; }
        .chip:hover { background: #0d0d0d; color: white; border-color: #0d0d0d; }
        .msg-user { display: flex; justify-content: flex-end; }
        .bubble-user { background: #0d0d0d; color: white; border-radius: 18px 18px 4px 18px; padding: 11px 16px; font-size: 14px; line-height: 1.55; max-width: 82%; }
        .msg-ai { display: flex; flex-direction: column; gap: 10px; }
        .ai-text { font-size: 14px; color: #555; line-height: 1.65; max-width: 90%; }
        .ai-text strong { color: #111; }
        .typing-dots { display: flex; gap: 4px; padding: 4px 0; }
        .typing-dots span { width: 6px; height: 6px; border-radius: 50%; background: #e0e0e0; animation: bounce 0.9s infinite; }
        .typing-dots span:nth-child(2) { animation-delay: 0.15s; }
        .typing-dots span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes bounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-5px); } }
        .searching-pill { display: inline-flex; align-items: center; gap: 7px; padding: 7px 14px; border-radius: 20px; background: #f7f7f7; border: 1px solid #e8e8e8; font-size: 12px; color: #666; }
        .search-dot { width: 6px; height: 6px; border-radius: 50%; background: #CC0000; animation: blink 1.5s infinite; flex-shrink: 0; }
        @keyframes blink { 0%,100%{opacity:1}50%{opacity:0.2} }
        .results-wrap { display: flex; flex-direction: column; gap: 10px; }
        .results-label { font-size: 10px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 0.08em; display: flex; align-items: center; gap: 8px; }
        .results-label::after { content: ''; flex: 1; height: 1px; background: #e8e8e8; }
        .prod-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        @media (min-width: 600px) { .prod-grid { grid-template-columns: repeat(4, 1fr); } }
        .see-more-btn { width: 100%; padding: 12px; border-radius: 10px; border: 1.5px solid #e8e8e8; background: white; font-size: 13px; font-weight: 600; color: #555; cursor: pointer; transition: all 0.15s; font-family: inherit; }
        .see-more-btn:hover { border-color: #0d0d0d; color: #0d0d0d; }
        .ai-stamp { font-size: 11px; color: #999; text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .ai-dot { width: 5px; height: 5px; border-radius: 50%; background: #CC0000; animation: blink 2s infinite; flex-shrink: 0; }
        .no-results { font-size: 13px; color: #999; font-style: italic; }
        .input-area { position: sticky; bottom: 0; background: white; padding: 10px 16px 16px; border-top: 1px solid #e8e8e8; }
        .input-box { background: white; border: 2px solid #e8e8e8; border-radius: 14px; padding: 5px 5px 5px 16px; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); transition: border-color 0.2s, box-shadow 0.2s; }
        .input-box:focus-within { border-color: #0d0d0d; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .chat-input { flex: 1; border: none; outline: none; font-size: 15px; color: #111; background: transparent; padding: 8px 0; font-family: inherit; }
        .chat-input::placeholder { color: #bbb; }
        .chat-input:disabled { opacity: 0.5; }
        .send-btn { width: 42px; height: 42px; background: #0d0d0d; border: none; border-radius: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: background 0.15s; }
        .send-btn:hover { background: #CC0000; }
        .send-btn:disabled { opacity: 0.4; cursor: default; }
        .drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.25); opacity: 0; pointer-events: none; transition: opacity 0.3s; z-index: 100; }
        .drawer-overlay.open { opacity: 1; pointer-events: all; }
        .drawer { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%) translateY(100%); width: 100%; max-width: 680px; background: white; border-radius: 20px 20px 0 0; box-shadow: 0 -8px 40px rgba(0,0,0,0.18); transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1); z-index: 101; overflow-y: auto; max-height: 88vh; padding-bottom: 32px; }
        .drawer.open { transform: translateX(-50%) translateY(0); }
        .drawer-handle { width: 40px; height: 4px; background: #e0e0e0; border-radius: 2px; margin: 12px auto 0; }
        .drawer-close { position: absolute; top: 14px; right: 16px; width: 32px; height: 32px; border-radius: 50%; background: #f7f7f7; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 15px; color: #555; }
        .drawer-content { padding: 0; }
        .drawer-img { aspect-ratio: 16/9; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; margin: 16px 20px 0; border-radius: 14px; }
        .drawer-src-tag { position: absolute; top: 10px; left: 10px; background: rgba(13,13,13,0.75); color: white; font-size: 9px; font-weight: 800; padding: 3px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.04em; }
        .drawer-info { padding: 16px 20px; }
        .drawer-cat { font-size: 10px; font-weight: 800; color: #CC0000; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px; }
        .drawer-title { font-family: 'Oswald', sans-serif; font-size: 24px; font-weight: 700; line-height: 1.15; margin-bottom: 10px; color: #111; }
        .ai-found-pill { display: inline-flex; align-items: center; gap: 5px; background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 20px; margin-bottom: 14px; }
        .price-block { background: #f7f7f7; border-radius: 12px; padding: 14px; margin-bottom: 12px; }
        .price-main-row { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 3px; }
        .price-big { font-size: 30px; font-weight: 700; letter-spacing: -0.03em; }
        .price-cur { font-size: 14px; color: #999; }
        .price-old { font-size: 13px; color: #bbb; text-decoration: line-through; }
        .price-tag { font-size: 10px; font-weight: 700; background: #fef9c3; border: 1px solid #fde68a; color: #854d0e; padding: 2px 7px; border-radius: 20px; }
        .price-cop { font-size: 12px; color: #999; margin-top: 2px; }
        .price-ship { font-size: 11px; color: #15803d; font-weight: 600; margin-top: 6px; }
        .delivery-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 10px 14px; margin-bottom: 12px; display: flex; gap: 10px; align-items: center; }
        .del-time { font-size: 14px; font-weight: 600; color: #1e3a5f; }
        .del-note { font-size: 11px; color: #3b82f6; margin-top: 1px; }
        .qty-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
        .qty-label { font-size: 12px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 0.05em; }
        .qty-ctrl { display: inline-flex; border: 2px solid #0d0d0d; border-radius: 9px; overflow: hidden; }
        .qty-btn { width: 38px; height: 38px; background: white; border: none; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-family: inherit; }
        .qty-btn:hover { background: #f7f7f7; }
        .qty-val { width: 44px; text-align: center; font-size: 15px; font-weight: 700; background: white; color: #111; line-height: 38px; }
        .stock-ok { font-size: 12px; font-weight: 600; color: #15803d; }
        .btn-buy { width: 100%; padding: 15px; background: #CC0000; border: none; color: white; font-size: 15px; font-weight: 700; border-radius: 12px; font-family: inherit; cursor: pointer; margin-bottom: 9px; transition: background 0.15s; }
        .btn-buy:hover { background: #A80000; }
        .btn-cart-drawer { width: 100%; padding: 15px; background: white; border: 2px solid #0d0d0d; color: #0d0d0d; font-size: 15px; font-weight: 700; border-radius: 12px; font-family: inherit; cursor: pointer; margin-bottom: 12px; transition: all 0.15s; }
        .btn-cart-drawer:hover { background: #0d0d0d; color: white; }
        .trust-row { display: flex; gap: 14px; justify-content: center; font-size: 11px; color: #999; flex-wrap: wrap; }
        .cart-fab { position: fixed; bottom: 20px; right: 20px; background: #0d0d0d; color: white; border: none; padding: 12px 20px; border-radius: 30px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.25); z-index: 50; font-family: inherit; transition: background 0.15s; }
        .cart-fab:hover { background: #CC0000; }
      `}</style>
    </div>
  );
}

// ── PRODUCT CARD COMPONENT ────────────────────
function ProductCardUI({ product, onView }: { product: ProductCard; onView: () => void }) {
  const SUPPLIER_LABELS: Record<string, string> = {
    midtown: 'Midtown', amazon: 'Amazon', ironstudios: 'Iron Studios', panini: 'Panini',
  };

  return (
    <div
      onClick={onView}
      style={{
        background: 'white', border: '1.5px solid #e8e8e8', borderRadius: 12,
        overflow: 'hidden', cursor: 'pointer', transition: 'all 0.18s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#0d0d0d')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#e8e8e8')}
    >
      {/* Image */}
      <div style={{ aspectRatio: '3/4', background: 'linear-gradient(135deg, #0d1b35, #1e3a5f)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', fontSize: 32 }}>
        {product.image_url ? (
          <img src={product.image_url} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : '📚'}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(0deg, rgba(0,0,0,0.6), transparent)', padding: '18px 8px 5px', fontSize: 9, fontWeight: 800, color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {SUPPLIER_LABELS[product.supplier] || product.supplier}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 10 }}>
        <p style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3, color: '#111', marginBottom: 5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {product.title}
        </p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>${product.price_usd.toFixed(2)}</span>
          <span style={{ fontSize: 10, color: '#bbb', textDecoration: 'line-through' }}>${product.price_original.toFixed(2)}</span>
        </div>
        <p style={{ fontSize: 10, color: '#999', marginBottom: 6 }}>{product.shipping_time}</p>
        <button
          style={{ width: '100%', padding: '7px', background: '#0d0d0d', border: 'none', color: 'white', fontSize: 11, fontWeight: 700, borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#CC0000')}
          onMouseLeave={e => (e.currentTarget.style.background = '#0d0d0d')}
          onClick={e => { e.stopPropagation(); onView(); }}
        >
          Ver producto →
        </button>
      </div>
    </div>
  );
}
