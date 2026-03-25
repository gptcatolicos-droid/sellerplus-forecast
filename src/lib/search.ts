import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── CATALOG RULES ─────────────────────────────
const ALLOWED = {
  categories: [
    'comics DC', 'comics Marvel', 'manga', 
    'figuras Iron Studios', 'figuras McFarlane Toys',
    'figuras Star Wars McFarlane', 'Funko Pop DC/Marvel/StarWars/Manga',
    'juguetes oficiales de comics'
  ],
  franchises: [
    // DC
    'Batman','Superman','Wonder Woman','Flash','Green Lantern','Aquaman',
    'Justice League','Joker','Harley Quinn','Nightwing','Robin','Catwoman',
    'Shazam','Black Adam','Supergirl','Zatanna','Constantine','Sandman',
    'Watchmen','V for Vendetta','Dark Knight','Swamp Thing','Green Arrow',
    // Marvel
    'Spider-Man','X-Men','Avengers','Iron Man','Captain America','Thor',
    'Hulk','Black Widow','Wolverine','Deadpool','Venom','Black Panther',
    'Doctor Strange','Daredevil','Punisher','Ghost Rider','Silver Surfer',
    'Guardians of the Galaxy','Fantastic Four','Ant-Man','Captain Marvel',
    'Moon Knight','Storm','Cyclops','Magneto','Thanos','Loki',
    // Manga
    'Naruto','Dragon Ball','One Piece','Attack on Titan','Demon Slayer',
    'Bleach','My Hero Academia','Death Note','Fullmetal Alchemist',
    'Hunter x Hunter','Jujutsu Kaisen','One Punch Man','Tokyo Ghoul',
    // Star Wars
    'Darth Vader','Luke Skywalker','Mandalorian','Yoda','Boba Fett',
    'Star Wars','Clone Wars',
  ],
  publishers: [
    'DC Comics','Marvel Comics','Image Comics','Dark Horse',
    'Viz Media','Kodansha','Shonen Jump','Yen Press',
    'Panini Comics','Iron Studios','McFarlane Toys','Funko',
    'Lucasfilm','Star Wars','Hasbro',
  ],
  maxPriceUsd: 500,
  suppliers: ['Midtown Comics','Amazon','Iron Studios','Panini Colombia'],
  shippingTimes: {
    midtown: '6–10 días hábiles',
    amazon: '8–15 días hábiles',
    ironstudios: '5–8 días hábiles',
    panini: '3–5 días hábiles (solo Colombia)',
  }
};

const SYSTEM_STORE = `Eres el asistente experto de La Tienda de Comics, la mejor tienda de cómics, figuras y manga de LATAM. Hablas español e inglés según el cliente.

SOLO vendes estas categorías:
${ALLOWED.categories.join(', ')}

Si alguien pide algo fuera de estas categorías (ropa, libros de cocina, electrónicos, etc.), responde amablemente que solo manejas cómics, figuras, manga y juguetes oficiales de DC, Marvel y Star Wars.

Cuando el cliente mencione un producto o personaje:
1. Muestra entusiasmo y contexto sobre ese cómic/personaje (1-2 frases)
2. Di que estás buscando en tiempo real
3. Sé conversacional y apasionado sobre el universo de cómics

Respuestas cortas y directas. Máximo 3 oraciones antes de mostrar resultados.
No inventes precios ni disponibilidad — eso lo maneja el sistema de búsqueda.`;

// ── GPT-4o STREAMING CHAT ─────────────────────
// Fast conversational response while search runs in parallel
export async function* streamChatResponse(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
) {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_STORE },
    ...history.slice(-8).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: message },
  ];

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    max_tokens: 200,
    temperature: 0.7,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

// ── CLAUDE: SMART SEARCH INTENT ──────────────
// Claude analyzes what to search for and in which providers
export async function analyzeSearchIntent(message: string): Promise<{
  should_search: boolean;
  query_en: string;          // English query for Midtown/Amazon
  query_es: string;          // Spanish query for Panini
  category: string;
  franchise?: string;
  search_providers: string[]; // which providers to hit
  is_figure: boolean;        // Iron Studios / McFarlane search
}> {
  const prompt = `Analyze this customer message and determine what product to search for.

Customer message: "${message}"

Allowed categories: ${ALLOWED.categories.join(', ')}
Allowed franchises: ${ALLOWED.franchises.join(', ')}

Return ONLY valid JSON (no markdown, no explanation):
{
  "should_search": true/false,
  "query_en": "english search query for Midtown Comics and Amazon",
  "query_es": "consulta en español para Panini Colombia",
  "category": "comics_dc|comics_marvel|manga|figura|funko|juguete",
  "franchise": "franchise name if detected",
  "search_providers": ["midtown","amazon","ironstudios","panini"],
  "is_figure": true/false
}

Rules:
- should_search = false if the request is off-category (food, clothes, electronics, etc.)
- Include "ironstudios" in providers only if asking for premium figures
- Include "panini" only for Spanish-language comics or if user seems to be from Colombia
- Always include "midtown" and "amazon" for comics/figures
- is_figure = true for action figures, statues, dioramas, Funko Pop`;

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';
  
  try {
    return JSON.parse(text);
  } catch {
    return {
      should_search: true,
      query_en: message,
      query_es: message,
      category: 'comics',
      search_providers: ['midtown', 'amazon'],
      is_figure: false,
    };
  }
}

// ── LIVE SEARCH: MIDTOWN COMICS ───────────────
export async function searchMidtown(query: string): Promise<SearchResult[]> {
  try {
    const searchUrl = `https://www.midtowncomics.com/store/searchadv.asp?searchterm=${encodeURIComponent(query)}&PTYPE=1`;
    
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];
    const html = await res.text();
    const { load } = await import('cheerio');
    const $ = load(html);
    
    const results: SearchResult[] = [];

    // Parse Midtown search results
    $('.prd-item, .product-item, [class*="product"]').each((_, el) => {
      if (results.length >= 4) return false;
      const $el = $(el);
      const title = $el.find('[class*="title"], h3, .name').first().text().trim();
      const priceText = $el.find('[class*="price"], .price').first().text().trim();
      const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
      const link = $el.find('a').first().attr('href');
      const img = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src');

      if (title && price > 0 && price <= ALLOWED.maxPriceUsd) {
        results.push({
          title,
          price_original: price,
          price_currency: 'USD',
          supplier: 'midtown',
          supplier_url: link ? (link.startsWith('http') ? link : `https://www.midtowncomics.com${link}`) : searchUrl,
          image_url: img || null,
          in_stock: !$el.text().toLowerCase().includes('out of stock'),
          shipping_time: ALLOWED.shippingTimes.midtown,
        });
      }
    });

    return results;
  } catch {
    return [];
  }
}

// ── LIVE SEARCH: IRON STUDIOS (Shopify JSON) ──
export async function searchIronStudios(query: string): Promise<SearchResult[]> {
  try {
    const res = await fetch(
      `https://ironstudios.com/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=4`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const products = data.resources?.results?.products || [];

    return products.slice(0, 3).map((p: any) => ({
      title: p.title,
      price_original: parseFloat(p.price) / 100,
      price_currency: 'USD',
      supplier: 'ironstudios',
      supplier_url: `https://ironstudios.com/products/${p.handle}`,
      image_url: p.image,
      in_stock: p.available !== false,
      shipping_time: ALLOWED.shippingTimes.ironstudios,
    })).filter((p: SearchResult) => p.price_original <= ALLOWED.maxPriceUsd);
  } catch {
    return [];
  }
}

// ── LIVE SEARCH: PANINI COLOMBIA (Shopify JSON) ─
export async function searchPanini(query: string): Promise<SearchResult[]> {
  try {
    const res = await fetch(
      `https://paninitienda.com/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=3`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const products = data.resources?.results?.products || [];

    return products.slice(0, 2).map((p: any) => ({
      title: p.title,
      price_original: parseFloat(p.price) / 100,
      price_currency: 'COP',
      supplier: 'panini',
      supplier_url: `https://paninitienda.com/products/${p.handle}`,
      image_url: p.image,
      in_stock: p.available !== false,
      shipping_time: ALLOWED.shippingTimes.panini,
    }));
  } catch {
    return [];
  }
}

// ── LIVE SEARCH: AMAZON ───────────────────────
export async function searchAmazon(query: string): Promise<SearchResult[]> {
  // Use Amazon's public search endpoint (no API key needed for basic search)
  // For production: use Amazon Product Advertising API for better results
  try {
    const searchTerm = `${query} comic book`;
    const res = await fetch(
      `https://www.amazon.com/s?k=${encodeURIComponent(searchTerm)}&ref=nb_sb_noss`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html',
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    
    if (!res.ok) return [];
    const html = await res.text();
    const { load } = await import('cheerio');
    const $ = load(html);
    
    const results: SearchResult[] = [];
    $('[data-component-type="s-search-result"]').each((_, el) => {
      if (results.length >= 2) return false;
      const $el = $(el);
      const title = $el.find('h2 .a-text-normal').first().text().trim() ||
                    $el.find('[data-cy="title-recipe"] span').first().text().trim();
      const priceWhole = $el.find('.a-price-whole').first().text().replace(',','').trim();
      const priceFrac = $el.find('.a-price-fraction').first().text().trim();
      const price = priceWhole ? parseFloat(`${priceWhole}.${priceFrac || '00'}`) : 0;
      const asin = $el.attr('data-asin');
      const img = $el.find('img.s-image').first().attr('src');

      if (title && price > 0 && price <= ALLOWED.maxPriceUsd && asin) {
        results.push({
          title: title.slice(0, 80),
          price_original: price,
          price_currency: 'USD',
          supplier: 'amazon',
          supplier_url: `https://www.amazon.com/dp/${asin}`,
          image_url: img || null,
          in_stock: true,
          shipping_time: ALLOWED.shippingTimes.amazon,
        });
      }
    });
    return results;
  } catch {
    return [];
  }
}

// ── MASTER SEARCH FUNCTION ────────────────────
// Runs all providers in parallel using Claude's intent analysis
export async function liveSearch(
  message: string,
  intent?: Awaited<ReturnType<typeof analyzeSearchIntent>>
): Promise<SearchResult[]> {
  const si = intent || await analyzeSearchIntent(message);
  
  if (!si.should_search) return [];

  // Run all applicable searches in parallel
  const searches: Promise<SearchResult[]>[] = [];

  if (si.search_providers.includes('midtown')) {
    searches.push(searchMidtown(si.query_en));
  }
  if (si.search_providers.includes('ironstudios') || si.is_figure) {
    searches.push(searchIronStudios(si.query_en));
  }
  if (si.search_providers.includes('amazon')) {
    searches.push(searchAmazon(si.query_en));
  }
  if (si.search_providers.includes('panini')) {
    searches.push(searchPanini(si.query_es));
  }

  const allResults = await Promise.allSettled(searches);
  const combined: SearchResult[] = [];

  allResults.forEach(r => {
    if (r.status === 'fulfilled') combined.push(...r.value);
  });

  // Sort: in-stock first, then by supplier diversity
  const bySupplier: Record<string, SearchResult[]> = {};
  combined.forEach(r => {
    if (!bySupplier[r.supplier]) bySupplier[r.supplier] = [];
    bySupplier[r.supplier].push(r);
  });

  // Take best from each supplier, max 4 total
  const final: SearchResult[] = [];
  const suppliers = ['midtown', 'amazon', 'ironstudios', 'panini'];
  for (const s of suppliers) {
    if (bySupplier[s]?.length && final.length < 4) {
      final.push(bySupplier[s][0]);
    }
  }

  return final;
}

// ── CALCULATE SELLING PRICE ───────────────────
export function calcSellingPrice(
  originalPrice: number,
  currency: 'USD' | 'COP',
  exchangeRateCOP: number = 4100,
  marginPct: number = 25,
  shippingUsd: number = 10
): { price_usd: number; price_cop: number } {
  const baseUsd = currency === 'COP' ? originalPrice / exchangeRateCOP : originalPrice;
  const priceUsd = Math.round((baseUsd * (1 + marginPct / 100) + shippingUsd) * 100) / 100;
  const priceCop = Math.round(priceUsd * exchangeRateCOP);
  return { price_usd: priceUsd, price_cop: priceCop };
}

// ── TYPES ─────────────────────────────────────
export interface SearchResult {
  title: string;
  price_original: number;
  price_currency: 'USD' | 'COP';
  supplier: 'midtown' | 'amazon' | 'ironstudios' | 'panini';
  supplier_url: string;
  image_url: string | null;
  in_stock: boolean;
  shipping_time: string;
}

export interface ProductCard extends SearchResult {
  price_usd: number;    // Your selling price
  price_cop: number;    // COP equivalent
  margin_pct: number;
}

export { ALLOWED };
