/**
 * CLAUDE AI — Admin tools only
 * SEO, descripciones, títulos, alt text
 */
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── SEO COMPLETO ─────────────────────────────
export async function generateSeoData(product: {
  title: string; description?: string; category?: string; publisher?: string;
}) {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: `Genera SEO en español para esta tienda de cómics colombiana "La Tienda de Comics".
Producto: ${product.title}
Categoría: ${product.category || 'comics'}
Editorial: ${product.publisher || ''}

Devuelve SOLO JSON válido sin markdown:
{
  "meta_title": "título SEO máx 60 chars con keyword Colombia o LATAM",
  "meta_description": "descripción SEO máx 155 chars con llamado a la acción",
  "seo_keywords": ["keyword1","keyword2","keyword3","keyword4","keyword5"],
  "slug": "slug-url-limpio-sin-caracteres-especiales"
}`,
    }],
  });

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
  try {
    const clean = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

// ── DESCRIPCIÓN ──────────────────────────────
export async function generateDescription(product: {
  title: string; category?: string; publisher?: string; franchise?: string;
}) {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `Escribe una descripción atractiva en español para vender este producto en Colombia.
Título: ${product.title}
Editorial/Marca: ${product.publisher || ''}
Franquicia: ${product.franchise || ''}
Categoría: ${product.category || 'comics'}

2-3 párrafos, tono entusiasta pero profesional. Incluye por qué es imprescindible para coleccionistas.`,
    }],
  });

  return msg.content[0].type === 'text' ? msg.content[0].text : '';
}

// ── DESCRIPCIÓN EN INGLÉS ─────────────────────
export async function generateDescriptionEn(spanishDesc: string) {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `Translate this product description to English for an international audience:\n\n${spanishDesc}`,
    }],
  });
  return msg.content[0].type === 'text' ? msg.content[0].text : '';
}

// ── ALT TEXT PARA IMÁGENES ────────────────────
export async function generateAltText(productTitle: string, imageIndex: number) {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 80,
    messages: [{
      role: 'user',
      content: `Genera alt text SEO en español para imagen ${imageIndex + 1} del producto: "${productTitle}". Máx 100 caracteres. Solo el texto, sin comillas.`,
    }],
  });
  return msg.content[0].type === 'text' ? msg.content[0].text.trim() : productTitle;
}

// ── ARTÍCULO DE BLOG SEO ──────────────────────
export async function generateBlogArticle(topic: string, keywords: string[]) {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Escribe un artículo de blog SEO en español para "La Tienda de Comics" sobre: ${topic}

Keywords a incluir: ${keywords.join(', ')}

Formato:
- Título H1 atractivo con keyword principal
- Introducción (100 palabras)  
- 3-4 secciones H2 con contenido valioso
- Conclusión con llamado a la acción
- Meta description al final entre [META] tags

Tono: experto pero accesible. Audiencia: colombianos y latinoamericanos fans de cómics.`,
    }],
  });
  return msg.content[0].type === 'text' ? msg.content[0].text : '';
}

// ── CHAT SOBRE PRODUCTO (en ficha) ───────────
export async function chatAboutProduct(
  product: { title: string; description: string; price: string },
  userMessage: string
) {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `Eres experto en cómics. El cliente pregunta sobre este producto:
Título: ${product.title}
Precio: ${product.price}
Descripción: ${product.description}

Pregunta del cliente: ${userMessage}

Responde en máximo 2 oraciones, en español, de forma experta y útil.`,
    }],
  });
  return msg.content[0].type === 'text' ? msg.content[0].text : '';
}
