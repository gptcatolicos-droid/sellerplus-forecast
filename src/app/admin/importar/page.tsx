'use client';
import { useState, useRef } from 'react';

interface ImportResult {
  url: string;
  status: 'ok' | 'error';
  title?: string;
  price?: number;
  error?: string;
}

export default function BulkImportPage() {
  const [text, setText] = useState('');
  const [results, setResults] = useState<ImportResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{inserted:number,skipped:number}|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Parse URLs from CSV or plain text
  function extractUrls(raw: string): string[] {
    const lines = raw.split(/[\n,;\r]+/);
    const urls: string[] = [];
    const seen = new Set<string>();
    for (const line of lines) {
      const trimmed = line.trim().replace(/^["']|["']$/g, '');
      if (!trimmed.startsWith('http')) continue;
      // Clean Amazon URLs to just dp/ASIN
      const asin = trimmed.match(/\/dp\/([A-Z0-9]{10})/);
      const clean = asin
        ? `https://www.amazon.com/dp/${asin[1]}`
        : trimmed.split('?')[0];
      if (!seen.has(clean)) {
        seen.add(clean);
        urls.push(clean);
      }
    }
    return urls;
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setText(content);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    const urls = extractUrls(text);
    if (!urls.length) return;
    setLoading(true);
    setResults([]);
    setProgress(0);

    const newResults: ImportResult[] = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        const res = await fetch('/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();

        if (data.success) {
          await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: data.data.title,
              description: data.data.description || data.data.title,
              price_usd: data.data.price_selling_usd,
              price_cop: data.data.price_cop,
              images: (data.data.images || []).map((u: string) => ({ url: u, alt: data.data.title })),
              supplier: data.data.supplier || 'amazon',
              supplier_url: url,
              stock: 10,
              status: 'published',
              category: data.data.category || 'comics',
            }),
          });
          newResults.push({ url, status: 'ok', title: data.data.title, price: data.data.price_selling_usd });
        } else {
          newResults.push({ url, status: 'error', error: data.error || 'Error al importar' });
        }
      } catch (err: any) {
        newResults.push({ url, status: 'error', error: err.message });
      }

      setResults([...newResults]);
      setProgress(Math.round(((i + 1) / urls.length) * 100));
      if (i < urls.length - 1) await new Promise(r => setTimeout(r, 700));
    }
    setLoading(false);
  }

  async function runSeed() {
    setSeeding(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();
      setSeedResult(data.results);
    } catch { setSeedResult(null); }
    setSeeding(false);
  }

  const urlCount = extractUrls(text).length;
  const ok = results.filter(r => r.status === 'ok').length;
  const bad = results.filter(r => r.status === 'error').length;

  return (
    <div style={{ padding: 32, maxWidth: 820 }}>
      <h1 style={{ fontFamily: 'Oswald,sans-serif', fontSize: 28, fontWeight: 700, marginBottom: 6 }}>
        Importar productos
      </h1>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
        Importa desde Amazon, Midtown Comics, Iron Studios o Panini — pegando URLs o subiendo un CSV.
      </p>

      {/* Seed Amazon preloaded */}
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#15803d', marginBottom: 2 }}>
            62 productos Amazon ya cargados
          </div>
          <div style={{ fontSize: 12, color: '#16a34a' }}>
            Batman, Superman, Spider-Man, Avengers, Daredevil y más — listos para importar
          </div>
          {seedResult && (
            <div style={{ fontSize: 12, color: '#15803d', marginTop: 4, fontWeight: 600 }}>
              ✓ {seedResult.inserted} importados, {seedResult.skipped} ya existian
            </div>
          )}
        </div>
        <button onClick={runSeed} disabled={seeding} style={{
          padding: '10px 22px', background: seeding ? '#999' : '#15803d',
          border: 'none', borderRadius: 10, color: 'white', fontSize: 13,
          fontWeight: 700, cursor: seeding ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        }}>
          {seeding ? 'Importando...' : '⚡ Importar Amazon ahora'}
        </button>
      </div>

      {/* CSV Upload */}
      <div style={{ background: '#fff', border: '1.5px dashed #d0d0d0', borderRadius: 12, padding: 16, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 2 }}>Subir archivo CSV</div>
          <div style={{ fontSize: 12, color: '#888' }}>Una URL por línea o columna. Soporta .csv y .txt</div>
        </div>
        <button onClick={() => fileRef.current?.click()} style={{
          padding: '9px 20px', background: '#0D0D0D', border: 'none', borderRadius: 9,
          color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          📄 Subir CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} style={{ display: 'none' }} />
      </div>

      {/* Manual textarea */}
      <div style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>O pega las URLs manualmente:</div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={"https://www.amazon.com/dp/1401207529\nhttps://www.amazon.com/dp/1401294057\nhttps://ironstudios.com/products/batman-deluxe\nhttps://midtowncomics.com/..."}
        style={{
          width: '100%', height: 160, padding: 14, fontSize: 12,
          border: '1.5px solid #e0e0e0', borderRadius: 10, resize: 'vertical',
          fontFamily: 'monospace', outline: 'none', marginBottom: 12,
          boxSizing: 'border-box',
        }}
      />

      {/* Import button */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24 }}>
        <button onClick={handleImport} disabled={loading || urlCount === 0} style={{
          padding: '12px 28px', background: loading ? '#ccc' : '#CC0000',
          border: 'none', borderRadius: 10, color: 'white', fontSize: 14,
          fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        }}>
          {loading ? `Importando... ${progress}%` : `Importar ${urlCount} URL${urlCount !== 1 ? 's' : ''}`}
        </button>
        {loading && (
          <div style={{ flex: 1, height: 7, background: '#e0e0e0', borderRadius: 4 }}>
            <div style={{ width: `${progress}%`, height: '100%', background: '#CC0000', borderRadius: 4, transition: 'width .3s' }} />
          </div>
        )}
        {urlCount > 0 && !loading && (
          <span style={{ fontSize: 12, color: '#888' }}>{urlCount} URLs detectadas</span>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <span style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, color: '#15803d' }}>
              ✓ {ok} importados
            </span>
            {bad > 0 && (
              <span style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, color: '#dc2626' }}>
                ✗ {bad} errores
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {results.map((r, i) => (
              <div key={i} style={{
                background: r.status === 'ok' ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${r.status === 'ok' ? '#bbf7d0' : '#fecaca'}`,
                borderRadius: 8, padding: '9px 14px',
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <span style={{ flexShrink: 0 }}>{r.status === 'ok' ? '✅' : '❌'}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 2 }}>
                    {r.status === 'ok' ? r.title : r.error}
                  </div>
                  <div style={{ fontSize: 11, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.status === 'ok' ? `$${r.price?.toFixed(2)} USD · ` : ''}{r.url}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
