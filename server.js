const express = require('express');
const path    = require('path');
const fs      = require('fs');
const app     = express();

app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname)));

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', version: '3.0' }));

// Sitemap
app.get('/sitemap.xml', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const host = req.headers.host || 'ai.sellerplus.co';
  const base = `https://${host}`;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>${base}/terms.html</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.4</priority></url>
</urlset>`);
});

// Robots.txt
app.get('/robots.txt', (req, res) => {
  const host = req.headers.host || 'ai.sellerplus.co';
  res.setHeader('Content-Type', 'text/plain');
  res.send(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: https://${host}/sitemap.xml\n`);
});

// Anthropic API proxy — key never exposed to client
app.post('/api/ai', async (req, res) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(500).json({
      error: { message: 'API Key no configurada.' }
    });
  }
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });
    const data = await r.json();
    res.json(data);
  } catch (e) {
    console.error('AI API error:', e.message);
    res.status(500).json({ error: { message: e.message } });
  }
});

// All other routes → index.html
app.get('*', (req, res) => {
  const p = path.join(__dirname, 'index.html');
  if (fs.existsSync(p)) {
    res.sendFile(p);
  } else {
    res.status(404).send('<h2>index.html no encontrado</h2>');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ SellerPlus AI corriendo en puerto ${PORT}`);
  console.log(`🔑 API Key: ${process.env.ANTHROPIC_API_KEY ? 'Configurada ✓' : 'NO CONFIGURADA ✗'}`);
});
