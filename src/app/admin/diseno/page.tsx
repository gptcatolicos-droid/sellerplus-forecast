'use client';
import { useState, useEffect } from 'react';

const PRESET_BACKGROUNDS = [
  { id: 'comics', label: 'Comics Marvel/DC', url: '/background.jpg' },
  { id: 'dark', label: 'Oscuro', url: '' },
  { id: 'white', label: 'Blanco limpio', url: '' },
];

export default function DisenoPag() {
  const [backgrounds, setBackgrounds] = useState(PRESET_BACKGROUNDS);
  const [active, setActive] = useState('/background.jpg');
  const [opacity, setOpacity] = useState(75);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch('/api/settings?keys=background_url,background_opacity')
      .then(r => r.json())
      .then(d => {
        if (d.background_url) setActive(d.background_url);
        if (d.background_opacity) setOpacity(parseInt(d.background_opacity));
      }).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          background_url: active,
          background_opacity: String(opacity),
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  }

  async function uploadBg(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (data.url) {
        const newBg = { id: `custom-${Date.now()}`, label: file.name, url: data.url };
        setBackgrounds(prev => [...prev, newBg]);
        setActive(data.url);
      }
    } catch {}
    setUploading(false);
  }

  const overlayStyle = `rgba(255,255,255,${opacity / 100})`;

  return (
    <div style={{ padding: 32, maxWidth: 800 }}>
      <h1 style={{ fontFamily: 'Oswald,sans-serif', fontSize: 28, fontWeight: 700, marginBottom: 6 }}>Diseño del sitio</h1>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 28 }}>Configura el fondo y la apariencia del sitio.</p>

      {/* Background selector */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Fondo de pantalla</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
          {backgrounds.map(bg => (
            <div
              key={bg.id}
              onClick={() => setActive(bg.url)}
              style={{
                height: 90, borderRadius: 10, cursor: 'pointer', overflow: 'hidden',
                border: `3px solid ${active === bg.url ? '#CC0000' : '#e0e0e0'}`,
                background: bg.url ? `url(${bg.url}) center/cover` : '#f7f7f7',
                display: 'flex', alignItems: 'flex-end', position: 'relative',
                transition: 'border-color .15s',
              }}
            >
              {!bg.url && (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 11 }}>
                  {bg.label}
                </div>
              )}
              <div style={{ background: 'rgba(0,0,0,.5)', color: 'white', fontSize: 9, fontWeight: 700, padding: '3px 7px', width: '100%', textAlign: 'center' }}>
                {bg.label}
              </div>
              {active === bg.url && (
                <div style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, background: '#CC0000', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 700 }}>✓</div>
              )}
            </div>
          ))}

          {/* Upload custom */}
          <label style={{
            height: 90, borderRadius: 10, cursor: 'pointer',
            border: '2px dashed #e0e0e0', background: '#f9f9f9',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: '#999', fontSize: 11, fontWeight: 500, transition: 'border-color .15s',
          }}>
            <span style={{ fontSize: 22, marginBottom: 4 }}>{uploading ? '...' : '+'}</span>
            {uploading ? 'Subiendo...' : 'Subir imagen'}
            <input type="file" accept="image/*" onChange={uploadBg} style={{ display: 'none' }} disabled={uploading} />
          </label>
        </div>

        {/* Opacity slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Opacidad del overlay blanco</span>
            <span style={{ fontSize: 13, color: '#CC0000', fontWeight: 700 }}>{opacity}%</span>
          </div>
          <input
            type="range" min={40} max={95} value={opacity}
            onChange={e => setOpacity(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: '#CC0000' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#999', marginTop: 4 }}>
            <span>Fondo visible (40%)</span>
            <span>Fondo suave (95%)</span>
          </div>
        </div>

        {/* Preview */}
        {active && (
          <div style={{ marginTop: 16, borderRadius: 10, overflow: 'hidden', height: 100, position: 'relative', border: '1px solid #e0e0e0' }}>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${active})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            <div style={{ position: 'absolute', inset: 0, background: overlayStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>Vista previa del overlay</span>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={save}
        disabled={saving}
        style={{
          padding: '12px 32px', background: saved ? '#16a34a' : '#CC0000',
          border: 'none', borderRadius: 10, color: 'white',
          fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          transition: 'background .2s',
        }}
      >
        {saved ? '✓ Guardado' : saving ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </div>
  );
}
