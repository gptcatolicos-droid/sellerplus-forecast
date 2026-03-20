const express = require('express');
const path    = require('path');
const fs      = require('fs');
const app     = express();

app.use(express.json({ limit: '4mb' }));

const ROOT = __dirname;
app.use(express.static(ROOT));

app.get('/health', (_, res) => res.json({ ok: true }));

app.post('/api/ai', async (req, res) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: { message: 'ANTHROPIC_API_KEY no configurada en Render → Environment.' } });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(req.body)
    });
    res.json(await r.json());
  } catch (e) { res.status(500).json({ error: { message: e.message } }); }
});

app.get('*', (req, res) => {
  const p = path.join(ROOT, 'index.html');
  if (fs.existsSync(p)) {
    res.sendFile(p);
  } else {
    res.status(404).send(`<h2>index.html no encontrado</h2><p>Archivos en ${ROOT}: ${fs.readdirSync(ROOT).join(', ')}</p>`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ SellerPlus en puerto ${PORT}`);
  console.log(`🔑 API Key: ${process.env.ANTHROPIC_API_KEY ? 'OK ✓' : 'FALTA ✗'}`);
});
