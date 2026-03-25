'use client';
import { useState, useEffect, useRef } from 'react';
import ProductDrawer from './product/ProductDrawer';

interface Product {
  id: string; title: string; price_usd: number; price_cop: number;
  image: string; supplier_name: string; supplier_url: string;
  model: string; delivery_days: string;
}

const CHIPS = ['Batman', 'Spider-Man', 'Naruto', 'Iron Studios', 'X-Men', 'Dragon Ball', 'Funko Pop', 'Superman'];

export default function ShopPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [notFound, setNotFound] = useState('');
  const [view, setView] = useState<'search' | 'catalog'>('search');
  const [sortBy, setSortBy] = useState('reciente');
  const [drawerProduct, setDrawerProduct] = useState<Product | null>(null);
  const [bgUrl, setBgUrl] = useState('/background.jpg');
  const [bgOpacity, setBgOpacity] = useState(75);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/settings?keys=background_url,background_opacity')
      .then(r => r.json())
      .then(d => {
        if (d.background_url) setBgUrl(d.background_url);
        if (d.background_opacity) setBgOpacity(parseInt(d.background_opacity));
      }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/products?status=published&limit=200')
      .then(r => r.json())
      .then(d => {
        const items = (d.data?.items || []).map((p: any) => ({
          id: p.id, title: p.title,
          price_usd: p.price_usd, price_cop: p.price_cop,
          image: p.images?.[0]?.url || '',
          supplier_name: ({ amazon:'Amazon', midtown:'Midtown Comics', ironstudios:'Iron Studios', panini:'Panini' } as any)[p.supplier] || 'La Tienda',
          supplier_url: p.supplier_url || '',
          model: 'dropshipping',
          delivery_days: p.supplier === 'panini' ? '3-5' : p.supplier === 'ironstudios' ? '5-8' : '6-10',
        }));
        setCatalog(items);
      }).catch(() => {});
  }, []);

  async function search(q?: string) {
    const term = (q || query).trim();
    if (!term || loading) return;
    setQuery(term);
    setLoading(true);
    setSearched(true);
    setNotFound('');
    setResults([]);
    setView('search');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: term }] }),
      });
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      if (data.products?.length > 0) {
        setResults(data.products);
      } else {
        setNotFound(data.searchQuery || term);
      }
    } catch {
      setNotFound(term);
    } finally {
      setLoading(false);
    }
  }

  function sorted(items: Product[]) {
    const c = [...items];
    if (sortBy === 'az') return c.sort((a, b) => a.title.localeCompare(b.title));
    if (sortBy === 'precio_asc') return c.sort((a, b) => a.price_usd - b.price_usd);
    if (sortBy === 'precio_desc') return c.sort((a, b) => b.price_usd - a.price_usd);
    return c;
  }

  const tabBtn = (active: boolean) => ({
    padding: '8px 22px', borderRadius: 30, fontSize: 12, fontWeight: 700,
    background: active ? '#0D0D0D' : 'rgba(255,255,255,0.9)',
    color: active ? 'white' : '#555',
    border: active ? 'none' : '1.5px solid #E8E8E8',
    cursor: 'pointer' as const, fontFamily: 'inherit',
  });

  return (
    <>
      <div style={{
        minHeight: '100vh',
        backgroundImage: `url(${bgUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}>
        <div style={{
          minHeight: '100vh',
          background: `rgba(255,255,255,${bgOpacity/100})`,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '40px 20px 100px',
        }}>

          {/* Logo + Title */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <img src="/logo.webp" alt="La Tienda de Comics" style={{ height: 52, margin: '0 auto 14px' }} />
            <h1 style={{
              fontFamily: 'Oswald, sans-serif',
              fontSize: 'clamp(20px, 4vw, 32px)',
              fontWeight: 700, color: '#111',
              textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 4,
            }}>
              La Tienda de Comics IA
            </h1>
            <p style={{ fontSize: 13, color: '#888' }}>La IA para comprar comics, figuras y manga</p>
          </div>

          {/* Search bar */}
          <div style={{ width: '100%', maxWidth: 600, display: 'flex', gap: 8, marginBottom: 16 }}>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center',
              background: '#fff', border: '2px solid #E8E8E8',
              borderRadius: 14, padding: '5px 5px 5px 16px',
              boxShadow: '0 4px 20px rgba(0,0,0,.08)',
            }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginRight: 10 }}>
                <circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search()}
                placeholder="Batman, Naruto, Iron Studios, Spider-Man..."
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: '#111', background: 'transparent', padding: '8px 0', fontFamily: 'inherit' }}
              />
              {query && (
                <button
                  onClick={() => { setQuery(''); setSearched(false); setResults([]); setNotFound(''); inputRef.current?.focus(); }}
                  style={{ background: 'none', border: 'none', color: '#ccc', fontSize: 20, padding: '0 8px', cursor: 'pointer', lineHeight: 1 }}
                >
                  x
                </button>
              )}
            </div>
            <button
              onClick={() => search()}
              disabled={loading || !query.trim()}
              style={{
                padding: '0 24px', background: loading ? '#ccc' : '#CC0000',
                border: 'none', borderRadius: 12, color: 'white',
                fontSize: 14, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                boxShadow: '0 4px 16px rgba(204,0,0,.3)',
                whiteSpace: 'nowrap',
              }}
            >
              {loading ? '...' : 'Buscar'}
            </button>
          </div>

          {/* Chips */}
          {!searched && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center', marginBottom: 24, maxWidth: 600 }}>
              {CHIPS.map(chip => (
                <button key={chip} onClick={() => search(chip)} style={{
                  padding: '7px 14px', borderRadius: 30, fontSize: 12, fontWeight: 500,
                  background: 'rgba(255,255,255,0.9)', border: '1.5px solid #E8E8E8',
                  color: '#555', cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
            <button onClick={() => setView('search')} style={tabBtn(view === 'search')}>
              Buscar
            </button>
            <button onClick={() => setView('catalog')} style={tabBtn(view === 'catalog')}>
              <img src="/logo.webp" alt="" style={{ height: 14, objectFit: 'contain', verticalAlign: 'middle', marginRight: 6 }} />
              Catalogo {catalog.length > 0 ? `(${catalog.length})` : ''}
            </button>
          </div>

          <div style={{ width: '100%', maxWidth: 900 }}>

            {/* SEARCH VIEW */}
            {view === 'search' && (
              <>
                {loading && (
                  <div style={{ textAlign: 'center', padding: '50px 0' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 14 }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#CC0000', animation: `bounce .8s ${i * 150}ms infinite` }} />
                      ))}
                    </div>
                    <p style={{ fontSize: 13, color: '#888' }}>Buscando en catalogo...</p>
                  </div>
                )}

                {!loading && notFound && (
                  <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fff', borderRadius: 16, border: '1.5px solid #E8E8E8' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>😕</div>
                    <p style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 6 }}>
                      "{notFound}" no esta en el catalogo aun
                    </p>
                    <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
                      Escribenos y lo conseguimos.
                    </p>
                    <a
                      href={"https://wa.me/573001234567?text=Hola! Quiero conseguir: " + notFound}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'inline-block', padding: '10px 24px', background: '#25D366', borderRadius: 10, color: 'white', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}
                    >
                      Pedir por WhatsApp
                    </a>
                  </div>
                )}

                {!loading && results.length > 0 && (
                  <>
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#CC0000' }} />
                      {results.length} resultado{results.length !== 1 ? 's' : ''} para "{query}"
                    </div>
                    <ProductGrid products={results} onSelect={setDrawerProduct} />
                  </>
                )}

                {!loading && !searched && (
                  <div style={{ textAlign: 'center', color: '#aaa', fontSize: 13, marginTop: 20 }}>
                    Escribe el nombre de un comic, figura o personaje
                  </div>
                )}
              </>
            )}

            {/* CATALOG VIEW */}
            {view === 'catalog' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                  <p style={{ fontSize: 13, color: '#666', fontWeight: 500 }}>{catalog.length} productos disponibles</p>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #E8E8E8', fontSize: 13, background: '#fff', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="reciente">Mas recientes</option>
                    <option value="az">A a Z</option>
                    <option value="precio_asc">Precio: menor a mayor</option>
                    <option value="precio_desc">Precio: mayor a menor</option>
                  </select>
                </div>

                {catalog.length > 0 && (
                  <ProductGrid products={sorted(catalog)} onSelect={setDrawerProduct} />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <ProductDrawer product={drawerProduct} onClose={() => setDrawerProduct(null)} />

      <style>{`
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-7px)} }
      `}</style>
    </>
  );
}

function ProductGrid({ products, onSelect }: { products: any[]; onSelect: (p: any) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: 14 }}>
      {products.map((p, i) => <ProductCard key={p.id || i} p={p} onClick={() => onSelect(p)} />)}
    </div>
  );
}

function ProductCard({ p, onClick }: { p: any; onClick: () => void }) {
  const cop = p.price_cop ? Number(p.price_cop).toLocaleString('es-CO') : Math.round(p.price_usd * 4100).toLocaleString('es-CO');
  return (
    <div
      onClick={onClick}
      style={{ background: '#fff', border: '1.5px solid #EFEFEF', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,.05)', transition: 'all .18s' }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = 'translateY(-3px)'; el.style.boxShadow = '0 8px 24px rgba(0,0,0,.12)'; el.style.borderColor = '#0D0D0D'; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = ''; el.style.boxShadow = '0 2px 10px rgba(0,0,0,.05)'; el.style.borderColor = '#EFEFEF'; }}
    >
      <div style={{ aspectRatio: '3/4', background: '#F7F7F7', position: 'relative', overflow: 'hidden' }}>
        {p.image
          ? <img src={p.image} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>📚</div>
        }
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(0deg,rgba(0,0,0,.7),transparent)', padding: '20px 8px 6px', fontSize: 9, fontWeight: 800, color: 'white', textTransform: 'uppercase', letterSpacing: '.05em' }}>
          {p.supplier_name}
        </div>
      </div>
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.35, color: '#111', marginBottom: 6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {p.title}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#CC0000' }}>${cop} COP</div>
        <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>Envio {p.delivery_days} dias · ${Number(p.price_usd).toFixed(2)} USD</div>
        <button style={{ width: '100%', padding: '8px 0', marginTop: 8, background: '#0D0D0D', border: 'none', color: 'white', fontSize: 11, fontWeight: 700, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
          Ver producto
        </button>
      </div>
    </div>
  );
}
