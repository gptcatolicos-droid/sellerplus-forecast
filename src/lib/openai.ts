import OpenAI from 'openai';
import { ALLOWED_FRANCHISES, BLOCKED_KEYWORDS, MAX_PRICE_USD } from './catalog-rules';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `Eres el asistente experto de La Tienda de Comics, la mejor tienda de cómics, figuras y manga de LATAM con sede en Colombia.

PERSONALIDAD: Experto apasionado en cómics. Hablas en español. Eres entusiasta pero conciso.

PUEDES AYUDAR CON:
- DC Comics: Batman, Superman, Wonder Woman, Flash, Aquaman, Justice League y todos sus personajes
- Marvel: Spider-Man, X-Men, Avengers, Wolverine, Deadpool y todos sus personajes  
- Manga: Naruto, Dragon Ball, One Piece, Demon Slayer, Attack on Titan y más
- Figuras: Iron Studios, McFarlane Toys (incluyendo Star Wars), Funko Pop
- Recomendaciones de lectura, historia de personajes, universos DC/Marvel

NO PUEDES AYUDAR CON:
- Productos fuera de cómics, figuras, manga y juguetes temáticos
- Si alguien pide algo fuera de categoría, responde amablemente que solo manejamos cómics, figuras y manga

CUANDO ENCUENTRES PRODUCTOS:
- Responde brevemente sobre el título/personaje (1-2 oraciones de contexto)
- Luego di que buscaste y encontraste opciones
- El sistema mostrará las tarjetas de producto automáticamente

FORMATO: Respuestas cortas y directas. Máximo 3 oraciones antes de mostrar productos.`;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SearchIntent {
  shouldSearch: boolean;
  query: string;
  category: 'comics_dc' | 'comics_marvel' | 'manga' | 'figuras' | 'funko' | 'star_wars' | 'general' | 'none';
  isAllowed: boolean;
  reason?: string;
}

// ── DETECT SEARCH INTENT ─────────────────────
export async function detectIntent(message: string): Promise<SearchIntent> {
  const msgLower = message.toLowerCase();

  // Block check
  const isBlocked = BLOCKED_KEYWORDS.some(k => msgLower.includes(k));
  if (isBlocked) {
    return { shouldSearch: false, query: '', category: 'none', isAllowed: false, reason: 'off_category' };
  }

  // Quick franchise match
  const matchedFranchise = ALLOWED_FRANCHISES.find(f => msgLower.includes(f.toLowerCase()));

  const mangaKeywords = ['manga','naruto','dragon ball','one piece','demon slayer','attack on titan','bleach','jujutsu','chainsaw man','berserk','jojo'];
  const figuraKeywords = ['figura','figure','iron studios','mcfarlane','funko','diorama','statue','estatua','coleccionable'];
  const dcKeywords = ['batman','superman','wonder woman','flash','aquaman','joker','harley','nightwing','dc comics','green lantern'];
  const marvelKeywords = ['spider','x-men','avengers','iron man','captain america','thor','hulk','wolverine','deadpool','venom','marvel'];
  const starwarsKeywords = ['star wars','darth','skywalker','mandalorian','yoda','boba fett'];

  let category: SearchIntent['category'] = 'general';
  if (mangaKeywords.some(k => msgLower.includes(k))) category = 'manga';
  else if (figuraKeywords.some(k => msgLower.includes(k))) category = 'figuras';
  else if (dcKeywords.some(k => msgLower.includes(k))) category = 'comics_dc';
  else if (marvelKeywords.some(k => msgLower.includes(k))) category = 'comics_marvel';
  else if (starwarsKeywords.some(k => msgLower.includes(k))) category = 'star_wars';

  const searchKeywords = ['quiero','busco','tienen','comprar','precio','conseguir','ver','necesito','donde','cuanto','cuesta'];
  const isSearchIntent = searchKeywords.some(k => msgLower.includes(k)) || matchedFranchise !== undefined;

  // If it mentions a franchise or has search intent and isn't blocked → search
  if ((matchedFranchise || isSearchIntent) && category !== 'none') {
    return {
      shouldSearch: true,
      query: message,
      category,
      isAllowed: true,
    };
  }

  // Pure knowledge question (no search needed)
  return { shouldSearch: false, query: '', category, isAllowed: true };
}

// ── CHAT WITH GPT-4o ─────────────────────────
export async function chatWithGPT(
  messages: ChatMessage[],
  hasProducts: boolean = false
): Promise<string> {
  const systemExtra = hasProducts
    ? '\n\nNota: Ya se mostraron tarjetas de productos al usuario. No menciones precios ni repitas los productos.'
    : '';

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT + systemExtra },
      ...messages,
    ],
    max_tokens: 300,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content || 'Lo siento, hubo un error. Intenta de nuevo.';
}

// ── STREAMING CHAT ────────────────────────────
export async function streamChatWithGPT(
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  hasProducts: boolean = false
): Promise<void> {
  const systemExtra = hasProducts
    ? '\n\nNota: Ya se mostraron tarjetas de productos al usuario.'
    : '';

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT + systemExtra },
      ...messages,
    ],
    max_tokens: 300,
    temperature: 0.7,
    stream: true,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || '';
    if (text) onChunk(text);
  }
}

// ── VERIFY PRODUCT BY TITLE (for Amazon URL validation) ──
export async function verifyProductByTitle(title: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: `¿Es este producto un cómic, manga, figura coleccionable, Funko Pop, juguete de DC/Marvel/Star Wars/Anime, o libro de historietas?
        
Producto: "${title}"

Responde SOLO con JSON: {"allowed": true/false, "reason": "explicación corta si no está permitido"}

Permitido: cómics DC/Marvel, manga, figuras Iron Studios/McFarlane, Funko Pop, Star Wars figuras, libros de historietas.
NO permitido: electrónicos, ropa, comida, cocina, tecnología, videojuegos no relacionados con comics, zapatos, muebles.`,
      }],
      max_tokens: 100,
      temperature: 0,
    });

    const text = response.choices[0]?.message?.content || '{"allowed":false}';
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return { allowed: false, reason: 'No se pudo verificar el producto.' };
  }
}
