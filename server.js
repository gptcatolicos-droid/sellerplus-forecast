const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const app      = express();

/* ═══════════════════════════════════════════════════════════
   SECURITY HEADERS MIDDLEWARE
   Applied to every response — no external dependencies needed
═══════════════════════════════════════════════════════════ */
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Force HTTPS (only in production)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  // XSS protection (legacy browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Referrer policy — send origin only, not full URL
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissions policy — disable unused browser features
  res.setHeader('Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()'
  );
  // Content Security Policy
  // Allows: self, Google Fonts, GA, Anthropic API (via our proxy only), CDN scripts
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com",
    "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://docs.google.com",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://docs.google.com"
  ].join('; '));

  next();
});

/* ═══════════════════════════════════════════════════════════
   CORS — only needed for /api/* endpoints
   Allows requests from the domain itself and localhost dev
═══════════════════════════════════════════════════════════ */
const ALLOWED_ORIGINS = [
  'https://sellerplus.ai',
  'https://www.sellerplus.ai',
  'https://sellerplus-ia.onrender.com',
  'http://localhost:3000',
  'http://localhost:3001'
];

function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  if (!origin || ALLOWED_ORIGINS.includes(origin)) {
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24h preflight cache
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
}

/* ═══════════════════════════════════════════════════════════
   SIMPLE RATE LIMITER (no external deps)
   Allows 60 requests/min per IP to /api/ai
═══════════════════════════════════════════════════════════ */
const rateLimitMap = new Map();
const RATE_WINDOW  = 60 * 1000; // 1 minute
const RATE_LIMIT   = 60;        // requests per window

function rateLimit(req, res, next) {
  const ip  = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, start: now };

  if (now - entry.start > RATE_WINDOW) {
    entry.count = 1;
    entry.start = now;
  } else {
    entry.count++;
  }
  rateLimitMap.set(ip, entry);

  // Clean up old entries every 5 min
  if (Math.random() < 0.01) {
    for (const [k, v] of rateLimitMap.entries()) {
      if (now - v.start > RATE_WINDOW * 5) rateLimitMap.delete(k);
    }
  }

  if (entry.count > RATE_LIMIT) {
    return res.status(429).json({ error: { message: 'Demasiadas solicitudes. Espera un momento.' } });
  }
  next();
}

/* ═══════════════════════════════════════════════════════════
   REQUEST SIZE LIMIT + BODY PARSER
═══════════════════════════════════════════════════════════ */
app.use(express.json({ limit: '2mb' })); // tighter than before

/* ═══════════════════════════════════════════════════════════
   STATIC FILES — with cache headers
═══════════════════════════════════════════════════════════ */
app.use(express.static(path.join(__dirname), {
  maxAge: '1d',
  etag:   true,
  setHeaders(res, filePath) {
    // HTML files — never cache so updates deploy immediately
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

/* ═══════════════════════════════════════════════════════════
   SITEMAP.XML
═══════════════════════════════════════════════════════════ */
app.get('/sitemap.xml', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
          http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">

  <!-- Página principal — Simulador + Listing Generator -->
  <url>
    <loc>https://sellerplus.ai/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>

  <!-- Términos y privacidad -->
  <url>
    <loc>https://sellerplus.ai/terms.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.4</priority>
  </url>

</urlset>`;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400'); // cache 24h
  res.send(sitemap);
});

/* ═══════════════════════════════════════════════════════════
   ROBOTS.TXT
═══════════════════════════════════════════════════════════ */
app.get('/robots.txt', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(`User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://sellerplus.ai/sitemap.xml
`);
});

/* ═══════════════════════════════════════════════════════════
   HEALTH CHECK
═══════════════════════════════════════════════════════════ */
app.get('/health', (_, res) => res.json({
  status: 'ok',
  version: '3.1',
  timestamp: new Date().toISOString()
}));

/* ═══════════════════════════════════════════════════════════
   ANTHROPIC API PROXY
   — API key never reaches the browser
   — Rate limited + CORS protected
═══════════════════════════════════════════════════════════ */
app.post('/api/ai', corsMiddleware, rateLimit, async (req, res) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error('[AI] ANTHROPIC_API_KEY not set');
    return res.status(500).json({
      error: { message: 'API Key no configurada. Ve a Render → Environment y agrega ANTHROPIC_API_KEY.' }
    });
  }

  // Validate body — must have messages array
  const body = req.body;
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return res.status(400).json({ error: { message: 'Request inválido: messages requerido.' } });
  }

  // Enforce safe model — prevent model injection
  const ALLOWED_MODELS = ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'];
  if (body.model && !ALLOWED_MODELS.includes(body.model)) {
    body.model = 'claude-sonnet-4-20250514';
  }

  // Enforce max_tokens ceiling
  if (!body.max_tokens || body.max_tokens > 8000) {
    body.max_tokens = 4000;
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    const data = await r.json();

    // Don't leak error details in production
    if (data.error) {
      console.error('[AI] Anthropic error:', data.error.type, data.error.message?.slice(0, 100));
    }

    res.status(r.status).json(data);
  } catch (e) {
    console.error('[AI] Fetch error:', e.message);
    res.status(502).json({ error: { message: 'Error de conexión con la IA. Intenta de nuevo.' } });
  }
});

/* ═══════════════════════════════════════════════════════════
   BLOCK SENSITIVE PATHS (security hardening)
═══════════════════════════════════════════════════════════ */
app.get([
  '/.env', '/.git', '/.gitignore',
  '/package.json', '/package-lock.json',
  '/server.js', '/node_modules'
], (req, res) => res.status(404).end());

/* ═══════════════════════════════════════════════════════════
   SPA FALLBACK — all routes → index.html
═══════════════════════════════════════════════════════════ */
app.get('*', (req, res) => {
  const p = path.join(__dirname, 'index.html');
  if (fs.existsSync(p)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(p);
  } else {
    res.status(404).send('<h2>index.html no encontrado</h2>');
  }
});

/* ═══════════════════════════════════════════════════════════
   START
═══════════════════════════════════════════════════════════ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅  SellerPlus AI corriendo en puerto ${PORT}`);
  console.log(`🔑  API Key: ${process.env.ANTHROPIC_API_KEY ? 'Configurada ✓' : 'NO CONFIGURADA ✗'}`);
  console.log(`🛡️   Security headers: activos`);
  console.log(`🗺️   Sitemap: https://sellerplus.ai/sitemap.xml`);
});

