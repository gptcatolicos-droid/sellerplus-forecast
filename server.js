const express = require('express');
const path    = require('path');
const fs      = require('fs');
const app     = express();

app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname)));

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', version: '3.0' }));

// Anthropic API proxy — key never exposed to client
app.post('/api/ai', async (req, res) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error('ANTHROPIC_API_KEY not set');
    return res.status(500).json({ 
      error: { message: 'API Key no configurada. Ve a Render → Environment y agrega ANTHROPIC_API_KEY.' } 
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
  console.log(`✅ SellerPlus Forecast corriendo en puerto ${PORT}`);
  console.log(`🔑 API Key: ${process.env.ANTHROPIC_API_KEY ? 'Configurada ✓' : 'NO CONFIGURADA ✗'}`);
});
