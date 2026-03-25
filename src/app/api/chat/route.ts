import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { query, ensureInit } from '@/lib/db';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM = `Eres el asistente de "La Tienda de Comics" — tienda de cómics, figuras y manga para Colombia y LATAM.

COMPORTAMIENTO:
- Cuando el usuario busque un producto, extrae el título en inglés y responde SOLO con:
  [BUSCAR:{"q":"título en inglés"}]
  Sin texto adicional. Solo ese JSON.
- Para preguntas generales sobre cómics, responde brevemente en español (máx 2 oraciones)
- Solo hablas de DC Comics, Marvel, Manga, Star Wars y figuras coleccionables
- Si preguntan por otra cosa: "Solo manejamos cómics, figuras y manga."

EJEMPLOS:
Usuario: "batman year one" → [BUSCAR:{"q":"Batman Year One"}]
Usuario: "muerte de superman" → [BUSCAR:{"q":"Death of Superman"}]
Usuario: "quiero naruto" → [BUSCAR:{"q":"Naruto manga"}]
Usuario: "figura iron man" → [BUSCAR:{"q":"Iron Man figure"}]
Usuario: "¿cuál es el mejor cómic de batman?" → Respuesta breve en español`;

async function searchProducts(q: string) {
  try {
    await ensureInit();
    const terms = q.toLowerCase().split(' ').filter(t => t.length > 2);
    if (!terms.length) return [];

    // Build search query
    const conditions = terms.slice(0, 3).map((_, i) => 
      `(LOWER(p.title) LIKE $${i + 1} OR LOWER(p.description) LIKE $${i + 1})`
    ).join(' OR ');
    const params = terms.slice(0, 3).map(t => `%${t}%`);

    const r = await query(`
      SELECT p.id, p.title, p.price_usd, p.price_cop, p.supplier, p.supplier_url, p.category,
             pi.url as image
      FROM products p
      LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = true
      WHERE p.status = 'published' AND (${conditions})
      ORDER BY p.created_at DESC
      LIMIT 8
    `, params);

    return r.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      price_usd: parseFloat(row.price_usd),
      price_cop: row.price_cop || Math.round(parseFloat(row.price_usd) * 4100),
      image: row.image || '',
      supplier: row.supplier,
      supplier_name: row.supplier === 'ironstudios' ? 'Iron Studios' 
        : row.supplier === 'panini' ? 'Panini Colombia'
        : row.supplier === 'amazon' ? 'Amazon'
        : row.supplier === 'midtown' ? 'Midtown Comics'
        : 'La Tienda',
      supplier_url: row.supplier_url || '',
      model: 'dropshipping',
      delivery_days: row.supplier === 'panini' ? '3–5' 
        : row.supplier === 'ironstudios' ? '5–8' : '6–10',
      in_stock: true,
    }));
  } catch (err) {
    console.error('Search error:', err);
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages } = body;
    if (!messages?.length) return NextResponse.json({ text: '', products: [] });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: SYSTEM }, ...messages],
      max_tokens: 100,
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content || '';
    const searchMatch = raw.match(/\[BUSCAR:\{"q":"([^"]+)"\}\]/);

    if (searchMatch) {
      const searchQuery = searchMatch[1];
      const products = await searchProducts(searchQuery);
      
      if (products.length > 0) {
        return NextResponse.json({ text: '', products, hasProducts: true });
      } else {
        // No products in catalog - suggest adding
        return NextResponse.json({ 
          text: `No encontré "${searchQuery}" en el catálogo. Puedes solicitarlo y lo conseguimos.`, 
          products: [],
          hasProducts: false,
          searchQuery,
        });
      }
    }

    // General question - return text response
    return NextResponse.json({ text: raw, products: [], hasProducts: false });

  } catch (err: any) {
    console.error('Chat error:', err?.message);
    return NextResponse.json({ text: 'Error de conexión. Intenta de nuevo.', products: [] });
  }
}
