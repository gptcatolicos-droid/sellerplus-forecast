/**
 * LIVE SEARCH — Midtown + Iron Studios + Panini
 * Amazon: import manual por ahora, PA API cuando tengamos 3 ventas
 */
import { query } from './db';

export interface LiveProduct {
  id: string;
  title: string;
  price_usd: number;
  price_cop: number;
  image: string;
  supplier: string;
  supplier_name: string;
  supplier_url: string;
  model: 'dropshipping' | 'affiliate';
  delivery_days: string;
  in_stock: boolean;
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function getCached(key: string): Promise<LiveProduct[] | null> {
  try {
    const r = await query(`SELECT value, updated_at FROM settings WHERE key = $1`, [`cache:${key}`]);
    if (!r.rows.length) return null;
    const age = Date.now() - new Date(r.rows[0].updated_at).getTime();
    if (age > 24 * 60 * 60 * 1000) return null;
    return JSON.parse(r.rows[0].value);
  } catch { return null; }
}

async function setCache(key: string, data: LiveProduct[]): Promise<void> {
  try {
    await query(
      `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`,
      [`cache:${key}`, JSON.stringify(data)]
    );
  } catch {}
}

async function searchIronStudios(q: string): Promise<LiveProduct[]> {
  try {
    const url = `https://ironstudios.com/search?type=product&q=${encodeURIComponent(q)}&view=json`;
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(7000) });
    if (!res.ok) return [];
    if (!(res.headers.get('content-type') || '').includes('json')) return [];
    const data = await res.json();
    const items = (data?.results || data?.products || []).slice(0, 3);
    return items.map((item: any) => {
      const price = (item?.price_min || item?.price || 0) / 100;
      const myPrice = Math.round((price * 1.25 + 10) * 100) / 100;
      return {
        id: `iron-${item?.id}`,
        title: item?.title || '',
        price_usd: myPrice,
        price_cop: Math.round(myPrice * 4100),
        image: item?.featured_image || '',
        supplier: 'ironstudios',
        supplier_name: 'Iron Studios',
        supplier_url: `https://ironstudios.com/products/${item?.handle || ''}`,
        model: 'dropshipping' as const,
        delivery_days: '5–8',
        in_stock: item?.available !== false,
      };
    }).filter((p: LiveProduct) => p.title && p.price_usd > 0);
  } catch { return []; }
}

async function searchPanini(q: string): Promise<LiveProduct[]> {
  try {
    const url = `https://paninitienda.com/search?type=product&q=${encodeURIComponent(q)}&view=json`;
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(7000) });
    if (!res.ok) return [];
    if (!(res.headers.get('content-type') || '').includes('json')) return [];
    const data = await res.json();
    const items = (data?.results || data?.products || []).slice(0, 2);
    return items.map((item: any) => {
      const priceCOP = (item?.price_min || item?.price || 0) / 100;
      const priceUSD = priceCOP / 4100;
      const myPrice = Math.round(priceUSD * 1.25 * 100) / 100;
      return {
        id: `panini-${item?.id}`,
        title: item?.title || '',
        price_usd: myPrice,
        price_cop: Math.round(priceCOP * 1.25),
        image: item?.featured_image || '',
        supplier: 'panini',
        supplier_name: 'Panini Colombia',
        supplier_url: `https://paninitienda.com/products/${item?.handle || ''}`,
        model: 'dropshipping' as const,
        delivery_days: '3–5',
        in_stock: item?.available !== false,
      };
    }).filter((p: LiveProduct) => p.title && p.price_usd > 0);
  } catch { return []; }
}

// Busca también en productos ya importados en la DB
async function searchCatalog(q: string): Promise<LiveProduct[]> {
  try {
    const terms = q.toLowerCase().split(' ').filter(t => t.length > 2);
    if (!terms.length) return [];
    const conditions = terms.map((_, i) => `(LOWER(title) LIKE $${i + 1} OR LOWER(description) LIKE $${i + 1})`).join(' AND ');
    const params = terms.map(t => `%${t}%`);
    const r = await query(
      `SELECT p.*, pi.url as img_url FROM products p
       LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = true
       WHERE p.status = 'published' AND (${conditions})
       LIMIT 4`,
      params
    );
    return r.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      price_usd: parseFloat(row.price_usd),
      price_cop: row.price_cop,
      image: row.img_url || '',
      supplier: row.supplier,
      supplier_name: row.supplier === 'amazon' ? 'Amazon' : row.supplier === 'midtown' ? 'Midtown Comics' : row.supplier === 'ironstudios' ? 'Iron Studios' : 'Panini',
      supplier_url: row.supplier_url || '',
      model: 'dropshipping' as const,
      delivery_days: row.supplier === 'panini' ? '3–5' : row.supplier === 'ironstudios' ? '5–8' : '6–10',
      in_stock: row.stock > 0 || row.stock === -1,
    }));
  } catch { return []; }
}

export async function liveSearch(searchQuery: string): Promise<LiveProduct[]> {
  const cacheKey = searchQuery.toLowerCase().trim().replace(/\s+/g, '-').slice(0, 80);

  const cached = await getCached(cacheKey);
  if (cached && cached.length > 0) return cached;

  // Search catalog first (instant), then external
  const [catalog, iron, panini] = await Promise.allSettled([
    searchCatalog(searchQuery),
    searchIronStudios(searchQuery),
    searchPanini(searchQuery),
  ]);

  const results: LiveProduct[] = [
    ...(catalog.status === 'fulfilled' ? catalog.value : []),
    ...(iron.status === 'fulfilled' ? iron.value : []),
    ...(panini.status === 'fulfilled' ? panini.value : []),
  ].filter(p => p.title && p.price_usd > 0);

  // Deduplicate by title similarity
  const seen = new Set<string>();
  const unique = results.filter(p => {
    const key = p.title.toLowerCase().slice(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);

  if (unique.length > 0) await setCache(cacheKey, unique);
  return unique;
}
