import * as cheerio from 'cheerio';
import type { ImportedProduct, SupplierSource } from '@/types';

// ── DETECT SUPPLIER FROM URL ──────────────────
export function detectSupplier(url: string): SupplierSource | null {
  if (url.includes('ironstudios.com')) return 'ironstudios';
  if (url.includes('paninitienda.com')) return 'panini';
  if (url.includes('midtowncomics.com')) return 'midtown';
  if (url.includes('amazon.com') || url.includes('amazon.co')) return 'amazon';
  return null;
}

// ── MAIN IMPORTER ─────────────────────────────
export async function importFromUrl(url: string): Promise<ImportedProduct> {
  const supplier = detectSupplier(url);
  if (!supplier) throw new Error('URL no reconocida. Proveedores soportados: Iron Studios, Panini, Midtown Comics, Amazon');

  switch (supplier) {
    case 'ironstudios': return importIronStudios(url);
    case 'panini': return importPanini(url);
    case 'midtown': return importMidtown(url);
    case 'amazon': return importAmazon(url);
    default: throw new Error('Proveedor no soportado');
  }
}

// ── IRON STUDIOS (Shopify JSON) ───────────────
async function importIronStudios(url: string): Promise<ImportedProduct> {
  const jsonUrl = url.replace(/\?.*$/, '') + '.json';

  const res = await fetch(jsonUrl, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) throw new Error(`Iron Studios: Error ${res.status}`);

  const data = await res.json();
  const p = data.product;
  if (!p) throw new Error('Iron Studios: producto no encontrado');

  const variant = p.variants?.[0];
  const images = (p.images || []).map((img: any) => img.src).filter(Boolean);
  const bodyHtml = p.body_html || '';
  const description = cheerio.load(bodyHtml).text().trim().slice(0, 2000);

  return {
    title: p.title || '',
    description,
    price_original: parseFloat(variant?.price || '0'),
    price_original_currency: 'USD',
    images,
    supplier: 'ironstudios',
    supplier_url: url,
    supplier_sku: variant?.sku || p.handle,
    publisher: 'Iron Studios',
    in_stock: variant?.inventory_quantity > 0 || variant?.inventory_management === null,
    franchise: extractFranchise(p.title || ''),
    characters: extractCharacters(p.title || ''),
  };
}

// ── PANINI COLOMBIA (Shopify JSON) ────────────
async function importPanini(url: string): Promise<ImportedProduct> {
  const cleanUrl = url.replace(/\?.*$/, '');
  const jsonUrl = cleanUrl.endsWith('.json') ? cleanUrl : cleanUrl + '.json';

  const res = await fetch(jsonUrl, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) throw new Error(`Panini: Error ${res.status}`);

  const data = await res.json();
  const p = data.product;
  if (!p) throw new Error('Panini: producto no encontrado');

  const variant = p.variants?.[0];
  const priceCOP = parseFloat(variant?.price || '0');
  const images = (p.images || []).map((img: any) => img.src).filter(Boolean);
  const bodyHtml = p.body_html || '';
  const description = cheerio.load(bodyHtml).text().trim().slice(0, 2000);

  return {
    title: p.title || '',
    description,
    price_original: priceCOP,
    price_original_currency: 'COP',
    images,
    supplier: 'panini',
    supplier_url: url,
    supplier_sku: variant?.sku || p.handle,
    publisher: 'Panini Colombia',
    in_stock: variant?.available !== false,
    franchise: extractFranchise(p.title || ''),
    characters: extractCharacters(p.title || ''),
  };
}

// ── MIDTOWN COMICS (HTML scrape) ──────────────
async function importMidtown(url: string): Promise<ImportedProduct> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!res.ok) throw new Error(`Midtown Comics: Error ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const title = $('h1.product-title, .productTitle, h1[itemprop="name"]').first().text().trim()
    || $('title').text().split('|')[0].trim();

  const priceText = $('[itemprop="price"], .price, .product-price').first().text().trim();
  const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;

  const description = $('[itemprop="description"], .product-description, .description').first().text().trim().slice(0, 2000);

  const images: string[] = [];
  $('img[itemprop="image"], .product-image img, .main-image img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src');
    if (src && !src.includes('placeholder') && !images.includes(src)) {
      images.push(src.startsWith('http') ? src : `https://www.midtowncomics.com${src}`);
    }
  });

  const inStock = !$('.out-of-stock, .unavailable').length
    && $('[itemprop="availability"]').attr('content') !== 'OutOfStock';

  return {
    title,
    description,
    price_original: price,
    price_original_currency: 'USD',
    images,
    supplier: 'midtown',
    supplier_url: url,
    publisher: extractPublisher($('body').text()),
    in_stock: inStock,
    franchise: extractFranchise(title),
    characters: extractCharacters(title),
  };
}

// ── AMAZON (via affiliate API or scrape fallback) ─
async function importAmazon(url: string): Promise<ImportedProduct> {
  // Extract ASIN from URL
  const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
  const asin = asinMatch?.[1];

  // If Amazon API keys are set, use the official API
  if (process.env.AMAZON_ACCESS_KEY && process.env.AMAZON_SECRET_KEY && asin) {
    return importAmazonViaAPI(asin, url);
  }

  // Fallback: basic HTML scrape (less reliable due to bot detection)
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
    },
  });

  if (!res.ok) throw new Error(`Amazon: Error ${res.status}. Considera configurar las credenciales de Amazon API.`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const title = $('#productTitle').text().trim() || $('h1').first().text().trim();
  const priceText = $('.a-price .a-offscreen, #priceblock_ourprice').first().text().trim();
  const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;

  const description = $('#feature-bullets li, #productDescription p')
    .map((_: any, el: any) => $(el).text().trim()).get().join(' ').slice(0, 2000);

  const images: string[] = [];
  $('#imgBlkFront, #landingImage, .imgTagWrapper img').each((_: any, el: any) => {
    const src = $(el).attr('src') || $(el).attr('data-a-dynamic-image');
    if (src && src.startsWith('http') && !images.includes(src)) {
      images.push(src);
    }
  });

  return {
    title,
    description,
    price_original: price,
    price_original_currency: 'USD',
    images,
    supplier: 'amazon',
    supplier_url: url,
    supplier_sku: asin,
    in_stock: !$('#outOfStock, .out-of-stock').length,
    franchise: extractFranchise(title),
    characters: extractCharacters(title),
  };
}

async function importAmazonViaAPI(asin: string, originalUrl: string): Promise<ImportedProduct> {
  // Amazon Product Advertising API 5.0 implementation
  // This requires AMAZON_ACCESS_KEY, AMAZON_SECRET_KEY, AMAZON_PARTNER_TAG
  const crypto = await import('crypto');

  const region = 'us-east-1';
  const service = 'ProductAdvertisingAPI';
  const host = 'webservices.amazon.com';
  const path = '/paapi5/getitems';

  const payload = JSON.stringify({
    ItemIds: [asin],
    PartnerTag: process.env.AMAZON_PARTNER_TAG,
    PartnerType: 'Associates',
    Resources: [
      'ItemInfo.Title',
      'ItemInfo.Features',
      'ItemInfo.ByLineInfo',
      'Offers.Listings.Price',
      'Images.Primary.Large',
      'Images.Variants.Large',
    ],
  });

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);

  const canonicalHeaders = `content-encoding:amz-1.0\ncontent-type:application/json; charset=utf-8\nhost:${host}\nx-amz-date:${amzDate}\nx-amz-target:com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems\n`;
  const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target';
  const payloadHash = crypto.default.createHash('sha256').update(payload).digest('hex');
  const canonicalRequest = `POST\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${crypto.default.createHash('sha256').update(canonicalRequest).digest('hex')}`;

  const getSignatureKey = (key: string, dateStamp: string, region: string, service: string) => {
    const kDate = crypto.default.createHmac('sha256', `AWS4${key}`).update(dateStamp).digest();
    const kRegion = crypto.default.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.default.createHmac('sha256', kRegion).update(service).digest();
    return crypto.default.createHmac('sha256', kService).update('aws4_request').digest();
  };

  const signingKey = getSignatureKey(process.env.AMAZON_SECRET_KEY!, dateStamp, region, service);
  const signature = crypto.default.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const authHeader = `AWS4-HMAC-SHA256 Credential=${process.env.AMAZON_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`https://${host}${path}`, {
    method: 'POST',
    headers: {
      'content-encoding': 'amz-1.0',
      'content-type': 'application/json; charset=utf-8',
      'host': host,
      'x-amz-date': amzDate,
      'x-amz-target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems',
      'Authorization': authHeader,
    },
    body: payload,
  });

  const data = await res.json();
  const item = data.ItemsResult?.Items?.[0];
  if (!item) throw new Error('Amazon API: producto no encontrado');

  const title = item.ItemInfo?.Title?.DisplayValue || '';
  const price = item.Offers?.Listings?.[0]?.Price?.Amount || 0;
  const images = [
    item.Images?.Primary?.Large?.URL,
    ...(item.Images?.Variants || []).map((v: any) => v.Large?.URL),
  ].filter(Boolean);
  const features = item.ItemInfo?.Features?.DisplayValues || [];
  const description = features.join(' ');

  return {
    title,
    description,
    price_original: price,
    price_original_currency: 'USD',
    images,
    supplier: 'amazon',
    supplier_url: originalUrl,
    supplier_sku: asin,
    in_stock: true,
    franchise: extractFranchise(title),
    characters: extractCharacters(title),
  };
}

// ── HELPERS ──────────────────────────────────
const FRANCHISES = ['Batman', 'Superman', 'Spider-Man', 'Iron Man', 'Captain America', 'Wolverine', 'X-Men', 'Avengers', 'Justice League', 'Wonder Woman', 'Flash', 'Green Lantern', 'Deadpool', 'Thor', 'Hulk'];
const PUBLISHERS = ['Marvel', 'DC Comics', 'Image Comics', 'Dark Horse', 'IDW', 'Boom Studios', 'Panini'];

function extractFranchise(text: string): string | undefined {
  for (const f of FRANCHISES) {
    if (text.toLowerCase().includes(f.toLowerCase())) return f;
  }
  return undefined;
}

function extractCharacters(text: string): string[] {
  return FRANCHISES.filter(c => text.toLowerCase().includes(c.toLowerCase()));
}

function extractPublisher(text: string): string | undefined {
  for (const p of PUBLISHERS) {
    if (text.includes(p)) return p;
  }
  return undefined;
}

// ── CALCULATE SELLING PRICE ───────────────────
export function calculateSellingPrice(
  originalPrice: number,
  currency: 'USD' | 'COP',
  marginPercent: number = 25,
  shippingUsd: number = 10,
  exchangeRateCOP: number = 4100,
): number {
  let baseUsd = currency === 'COP' ? originalPrice / exchangeRateCOP : originalPrice;
  return Math.round((baseUsd * (1 + marginPercent / 100) + shippingUsd) * 100) / 100;
}
