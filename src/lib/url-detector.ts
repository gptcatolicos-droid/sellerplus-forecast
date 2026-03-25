/**
 * URL DETECTOR — La Tienda de Comics
 * Detecta si un mensaje contiene una URL de proveedor conocido
 * y extrae el producto correspondiente.
 */

import { ALLOWED_FRANCHISES, BLOCKED_KEYWORDS } from './catalog-rules';

// ── AMAZON ALLOWED BROWSE NODES (categorías) ──
const AMAZON_ALLOWED_NODES = [
  'Books', 'Comics', 'Graphic Novels', 'Manga',
  'Toys & Games', 'Collectibles & Fine Art',
  'Action Figures', 'Statues', 'Pop Culture Merchandise',
  '4366', // Comics & Graphic Novels node ID
  '1', // Books
  '165793011', // Comics
  '4922741011', // Graphic Novels
];

const AMAZON_BLOCKED_CATEGORIES = [
  'Electronics', 'Clothing', 'Shoes', 'Kitchen', 'Automotive',
  'Sports', 'Beauty', 'Health', 'Grocery', 'Pet Supplies',
  'Office Products', 'Industrial', 'Musical Instruments',
  'Video Games', 'Software', 'Appliances', 'Tools',
];

export interface DetectedURL {
  supplier: 'midtown' | 'amazon' | 'iron_studios' | 'panini' | 'cheapgraphicnovels';
  url: string;
  asin?: string; // Amazon only
}

// ── DETECT URL IN MESSAGE ─────────────────────
export function detectURLInMessage(message: string): DetectedURL | null {
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = message.match(urlRegex);
  if (!urls) return null;

  for (const url of urls) {
    const lower = url.toLowerCase();

    if (lower.includes('midtowncomics.com')) {
      return { supplier: 'midtown', url };
    }
    if (lower.includes('ironstudios.com')) {
      return { supplier: 'iron_studios', url };
    }
    if (lower.includes('paninitienda.com')) {
      return { supplier: 'panini', url };
    }
    if (lower.includes('cheapgraphicnovels.com')) {
      return { supplier: 'cheapgraphicnovels', url };
    }
    if (lower.includes('amazon.com') || lower.includes('amzn.to')) {
      const asin = extractASIN(url);
      if (asin) return { supplier: 'amazon', url, asin };
    }
  }
  return null;
}

// ── EXTRACT AMAZON ASIN ───────────────────────
function extractASIN(url: string): string | null {
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
    /ASIN=([A-Z0-9]{10})/i,
    /\/([A-Z0-9]{10})(?:\/|\?|$)/i,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// ── VERIFY AMAZON PRODUCT IS ALLOWED ─────────
export async function verifyAmazonProduct(asin: string): Promise<{
  allowed: boolean;
  reason?: string;
  product?: any;
}> {
  try {
    const { signAmazonRequest } = await import('./amazon-auth');
    const partnerTag = process.env.AMAZON_PARTNER_TAG!;

    const payload = {
      ItemIds: [asin],
      Resources: [
        'ItemInfo.Title',
        'ItemInfo.Classifications',
        'ItemInfo.ByLineInfo',
        'Offers.Listings.Price',
        'Images.Primary.Large',
        'BrowseNodeInfo.BrowseNodes',
      ],
      PartnerTag: partnerTag,
      PartnerType: 'Associates',
      Marketplace: 'www.amazon.com',
    };

    const authHeader = await signAmazonRequest(payload, 'GetItems');
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';

    const res = await fetch('https://webservices.amazon.com/paapi5/getitems', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Encoding': 'amz-1.0',
        'X-Amz-Target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems',
        'X-Amz-Date': amzDate,
        'Authorization': authHeader,
        'Host': 'webservices.amazon.com',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return { allowed: false, reason: 'No se pudo verificar el producto en Amazon.' };

    const data = await res.json();
    const item = data.ItemsResult?.Items?.[0];
    if (!item) return { allowed: false, reason: 'Producto no encontrado en Amazon.' };

    const title = item.ItemInfo?.Title?.DisplayValue || '';
    const browseNodes = item.BrowseNodeInfo?.BrowseNodes || [];
    const browseNodeNames = browseNodes.map((n: any) => n.DisplayName || '').join(' ');

    // Check blocked categories first
    const isBlocked = AMAZON_BLOCKED_CATEGORIES.some(cat =>
      browseNodeNames.toLowerCase().includes(cat.toLowerCase())
    );
    if (isBlocked) {
      return {
        allowed: false,
        reason: `Solo vendemos cómics, figuras, manga y juguetes temáticos. Este producto (${title.slice(0, 50)}) no está en nuestras categorías.`,
      };
    }

    // Check if it's in allowed categories
    const isAllowed = AMAZON_ALLOWED_NODES.some(node =>
      browseNodeNames.toLowerCase().includes(node.toLowerCase()) ||
      browseNodes.some((n: any) => n.Id === node)
    );

    // If not clearly categorized, use GPT-4o to verify by title
    if (!isAllowed) {
      const { verifyProductByTitle } = await import('./openai');
      const aiVerdict = await verifyProductByTitle(title);
      if (!aiVerdict.allowed) {
        return {
          allowed: false,
          reason: aiVerdict.reason || `"${title.slice(0, 50)}" no parece ser un cómic, figura o manga.`,
        };
      }
    }

    // Build product object
    const price = item.Offers?.Listings?.[0]?.Price?.Amount || 0;
    const { applyMarginToPrice } = await import('./livesearch');
    const { price_usd, price_cop } = await applyMarginToPrice(price, 'amazon');

    return {
      allowed: true,
      product: {
        id: `amazon_${asin}`,
        title,
        price_usd,
        price_original_usd: price,
        price_cop,
        image_url: item.Images?.Primary?.Large?.URL || '',
        supplier: 'amazon',
        supplier_url: `https://www.amazon.com/dp/${asin}?tag=${partnerTag}`,
        affiliate_url: `https://www.amazon.com/dp/${asin}?tag=${partnerTag}`,
        model: 'affiliate',
        shipping_days: '8-15',
        in_stock: true,
        publisher: item.ItemInfo?.ByLineInfo?.Brand?.DisplayValue,
        category: 'comics',
      },
    };
  } catch (err: any) {
    console.error('verifyAmazonProduct error:', err);
    return { allowed: false, reason: 'Error al verificar el producto. Intenta de nuevo.' };
  }
}

// ── VERIFY PRODUCT TITLE WITH GPT-4o ─────────
// (used as fallback when Amazon category is ambiguous)
export async function verifyTitleWithAI(title: string): Promise<{ allowed: boolean; reason?: string }> {
  const titleLower = title.toLowerCase();

  // Quick check against allowed franchises
  const matchesFranchise = ALLOWED_FRANCHISES.some(f => titleLower.includes(f.toLowerCase()));
  if (matchesFranchise) return { allowed: true };

  // Check blocked keywords
  const isBlocked = BLOCKED_KEYWORDS.some(k => titleLower.includes(k));
  if (isBlocked) return { allowed: false, reason: `"${title.slice(0, 40)}" no está en nuestras categorías.` };

  // Comic/manga/figure keywords
  const comicKeywords = ['comic', 'manga', 'graphic novel', 'trade paperback', 'tpb',
    'figure', 'statue', 'diorama', 'funko', 'action figure', 'collectible',
    'dc ', 'marvel ', 'batman', 'superman', 'spider', 'naruto', 'dragon ball',
    'star wars', 'iron studios', 'mcfarlane'];
  const isComic = comicKeywords.some(k => titleLower.includes(k));
  if (isComic) return { allowed: true };

  return {
    allowed: false,
    reason: `Solo vendemos cómics, figuras, manga y juguetes temáticos de DC, Marvel, Star Wars y más.`,
  };
}
