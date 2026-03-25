/**
 * URL SCRAPER — extracts product data from a specific URL
 * Used when customer pastes a URL in the chat
 */
import * as cheerio from 'cheerio';
import { SUPPLIER_RULES } from './catalog-rules';

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,*/*',
      'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ── MIDTOWN COMICS ────────────────────────────
export async function scrapeMidtown(url: string): Promise<any | null> {
  try {
    // Try Shopify JSON first
    const jsonUrl = url.replace(/\?.*$/, '') + '.json';
    const res = await fetch(jsonUrl, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = await res.json();
      const p = data.product;
      if (p) {
        const price = parseFloat(p.variants?.[0]?.price || '0');
        const { applyMarginToPrice } = await import('./livesearch');
        const { price_usd, price_cop } = await applyMarginToPrice(price, 'midtown');
        return {
          title: p.title,
          price_usd, price_original_usd: price, price_cop,
          image_url: p.images?.[0]?.src || '',
          supplier: 'midtown', supplier_url: url,
          model: 'dropshipping',
          shipping_days: SUPPLIER_RULES.midtown.days,
          in_stock: p.variants?.[0]?.available !== false,
          category: 'comics',
        };
      }
    }

    // Fallback: HTML scraping
    const html = await fetchPage(url);
    const $ = cheerio.load(html);
    const title = $('h1').first().text().trim() || $('[class*="product-title"]').first().text().trim();
    const priceText = $('[class*="price"]').first().text().trim();
    const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
    const imageUrl = $('img[class*="product"]').first().attr('src') || '';
    if (!title || !price) return null;

    const { applyMarginToPrice } = await import('./livesearch');
    const { price_usd, price_cop } = await applyMarginToPrice(price, 'midtown');

    return {
      title, price_usd, price_original_usd: price, price_cop,
      image_url: imageUrl.startsWith('http') ? imageUrl : `https://www.midtowncomics.com${imageUrl}`,
      supplier: 'midtown', supplier_url: url,
      model: 'dropshipping', shipping_days: SUPPLIER_RULES.midtown.days,
      in_stock: !$('body').text().includes('Out of Stock'),
      category: 'comics',
    };
  } catch { return null; }
}

// ── IRON STUDIOS (Shopify JSON) ───────────────
export async function scrapeIronStudios(url: string): Promise<any | null> {
  try {
    const handle = url.split('/products/')[1]?.split('?')[0];
    if (!handle) return null;
    const jsonUrl = `https://ironstudios.com/products/${handle}.json`;
    const res = await fetch(jsonUrl, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const { product: p } = await res.json();
    const price = parseFloat(p.variants?.[0]?.price || '0');
    const { applyMarginToPrice } = await import('./livesearch');
    const { price_usd, price_cop } = await applyMarginToPrice(price, 'iron_studios');
    return {
      title: p.title,
      price_usd, price_original_usd: price, price_cop,
      image_url: p.images?.[0]?.src ? `https:${p.images[0].src}` : '',
      supplier: 'iron_studios', supplier_url: url,
      model: 'dropshipping', shipping_days: SUPPLIER_RULES.iron_studios.days,
      in_stock: p.variants?.[0]?.available !== false,
      category: 'figuras',
    };
  } catch { return null; }
}

// ── PANINI COLOMBIA (Shopify JSON) ────────────
export async function scrapePanini(url: string): Promise<any | null> {
  try {
    const handle = url.split('/products/')[1]?.split('?')[0];
    if (!handle) return null;
    const jsonUrl = `https://paninitienda.com/products/${handle}.json`;
    const res = await fetch(jsonUrl, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const { product: p } = await res.json();
    const priceCOP = parseFloat(p.variants?.[0]?.price || '0');
    const priceUSD = Math.round((priceCOP / 4100) * 100) / 100;
    const { applyMarginToPrice } = await import('./livesearch');
    const { price_usd, price_cop } = await applyMarginToPrice(priceUSD, 'panini');
    return {
      title: p.title,
      price_usd, price_original_usd: priceUSD, price_cop: Math.round(priceCOP * 1.25),
      image_url: p.images?.[0]?.src ? `https:${p.images[0].src}` : '',
      supplier: 'panini', supplier_url: url,
      model: 'dropshipping', shipping_days: SUPPLIER_RULES.panini.days,
      in_stock: p.variants?.[0]?.available !== false,
      category: 'comics',
    };
  } catch { return null; }
}

// ── CHEAPGRAPHICNOVELS (HTML) ─────────────────
export async function scrapeCheapGraphicNovels(url: string): Promise<any | null> {
  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);
    const title = $('h1').first().text().trim();
    const priceText = $('[class*="price"], .product-price').first().text().trim();
    const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
    const imageUrl = $('img.product-image, [class*="product-img"]').first().attr('src') || '';
    if (!title || !price) return null;

    // CheapGraphicNovels: reference only, show price but mark as reference
    const { applyMarginToPrice } = await import('./livesearch');
    const { price_usd, price_cop } = await applyMarginToPrice(price, 'midtown'); // use midtown margins

    return {
      title, price_usd, price_original_usd: price, price_cop,
      image_url: imageUrl.startsWith('http') ? imageUrl : `https://www.cheapgraphicnovels.com${imageUrl}`,
      supplier: 'midtown', // remap to midtown for purchasing
      supplier_url: url,
      model: 'dropshipping', shipping_days: '10-14',
      in_stock: !html.includes('Out of Stock'),
      category: 'comics',
      note: 'Precio de referencia — gestionamos la compra',
    };
  } catch { return null; }
}

// ── MAIN: SCRAPE FROM URL ─────────────────────
export async function scrapeProductFromURL(url: string, supplier: string): Promise<any | null> {
  switch (supplier) {
    case 'midtown': return scrapeMidtown(url);
    case 'iron_studios': return scrapeIronStudios(url);
    case 'panini': return scrapePanini(url);
    case 'cheapgraphicnovels': return scrapeCheapGraphicNovels(url);
    default: return null;
  }
}
