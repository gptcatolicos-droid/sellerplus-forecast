'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';

const CATEGORIES = ['comics', 'figuras', 'libros', 'coleccionables', 'manga'];
const STATUSES = [{ value: 'published', label: 'Publicado' }, { value: 'draft', label: 'Borrador' }, { value: 'archived', label: 'Archivado' }];

export default function ProductEditorPage() {
  const router = useRouter();
  const params = useParams();
  const isNew = params.id === 'nuevo';
  const [saving, setSaving] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '', title_en: '', description: '', description_en: '',
    price_usd: '', price_usd_original: '', price_old_usd: '',
    category: 'comics', supplier: 'manual', supplier_url: '', supplier_sku: '',
    stock: '0', status: 'draft',
    preventa_enabled: false, preventa_percent: '30', preventa_launch_date: '',
    meta_title: '', meta_description: '', seo_keywords: '',
    publisher: '', author: '', year: '', isbn: '', franchise: '',
    images: [] as { url: string; alt: string; is_primary: boolean }[],
  });

  useEffect(() => {
    if (!isNew) {
      fetch(`/api/products/${params.id}`).then(r => r.json()).then(d => {
        if (d.success) {
          const p = d.data;
          setForm({
            title: p.title || '', title_en: p.title_en || '',
            description: p.description || '', description_en: p.description_en || '',
            price_usd: String(p.price_usd || ''), price_usd_original: String(p.price_usd_original || ''),
            price_old_usd: String(p.price_old_usd || ''),
            category: p.category || 'comics', supplier: p.supplier || 'manual',
            supplier_url: p.supplier_url || '', supplier_sku: p.supplier_sku || '',
            stock: String(p.stock || 0), status: p.status || 'draft',
            preventa_enabled: Boolean(p.preventa_enabled), preventa_percent: String(p.preventa_percent || 30),
            preventa_launch_date: p.preventa_launch_date || '',
            meta_title: p.meta_title || '', meta_description: p.meta_description || '',
            seo_keywords: (p.seo_keywords || []).join(', '),
            publisher: p.publisher || '', author: p.author || '',
            year: String(p.year || ''), isbn: p.isbn || '', franchise: p.franchise || '',
            images: p.images || [],
          });
        }
      });
    }
  }, [params.id, isNew]);

  function set(k: string, v: any) { setForm(prev => ({ ...prev, [k]: v })); }

  // Calculate COP from USD
  const priceCop = form.price_usd ? Math.round(parseFloat(form.price_usd) * 4100).toLocaleString('es-CO') : '0';

  async function importProduct() {
    if (!importUrl.trim()) return;
    setImporting(true);
    try {
      const res = await fetch('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: importUrl }) });
      const data = await res.json();
      if (!data.success) { toast.error(data.error || 'Error al importar'); return; }
      const p = data.data;
      setForm(prev => ({
        ...prev,
        title: p.title || prev.title,
        description: p.description || prev.description,
        price_usd: String(p.price_selling_usd || ''),
        price_usd_original: String(p.price_original || ''),
        supplier: p.supplier, supplier_url: p.supplier_url,
        supplier_sku: p.supplier_sku || '',
        publisher: p.publisher || prev.publisher,
        franchise: p.franchise || prev.franchise,
        images: (p.images || []).slice(0, 10).map((url: string, i: number) => ({ url, alt: `${p.title} - imagen ${i + 1}`, is_primary: i === 0 })),
      }));
      toast.success('Producto importado — revisa y ajusta los campos');
    } catch (e: any) { toast.error(e.message || 'Error'); }
    setImporting(false);
  }

  async function generateAI(field: 'title' | 'description' | 'title_en' | 'description_en' | 'seo') {
    setAiLoading(field);
    try {
      if (field === 'seo') {
        const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate_seo', product: { title: form.title, description: form.description, category: form.category, publisher: form.publisher, franchise: form.franchise } }) });
        const data = await res.json();
        if (data.success) {
          setForm(prev => ({ ...prev, meta_title: data.data.meta_title, meta_description: data.data.meta_description, seo_keywords: (data.data.keywords || []).join(', ') }));
          toast.success('SEO generado');
        }
      } else if (field === 'description' || field === 'description_en') {
        const lang = field === 'description_en' ? 'en' : 'es';
        const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate_description', product: { title: form.title, publisher: form.publisher, author: form.author, year: parseInt(form.year) || undefined, category: form.category }, language: lang }) });
        const data = await res.json();
        if (data.success) { set(field, data.data.description); toast.success('Descripción generada'); }
      } else {
        const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate_title', raw_title: form.title, supplier: form.supplier }) });
        const data = await res.json();
        if (data.success) { set(field, data.data.title); toast.success('Título mejorado'); }
      }
    } catch { toast.error('Error con IA'); }
    setAiLoading(null);
  }

  async function addImageUrl() {
    const url = prompt('URL de la imagen:');
    if (!url) return;
    const newImg = { url, alt: `${form.title} - imagen ${form.images.length + 1}`, is_primary: form.images.length === 0 };
    set('images', [...form.images, newImg]);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    const fd = new FormData();
    Array.from(files).forEach(f => fd.append('files', f));
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.success) {
      const newImgs = data.data.map((u: any, i: number) => ({ url: u.url, alt: `${form.title} - imagen`, is_primary: form.images.length === 0 && i === 0 }));
      set('images', [...form.images, ...newImgs].slice(0, 10));
      toast.success(`${data.data.length} imagen(es) subida(s)`);
    }
  }

  function removeImage(i: number) {
    const imgs = form.images.filter((_, idx) => idx !== i);
    if (imgs.length > 0) imgs[0].is_primary = true;
    set('images', imgs);
  }

  async function save(status?: string) {
    if (!form.title) { toast.error('El título es requerido'); return; }
    if (!form.price_usd) { toast.error('El precio es requerido'); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title, title_en: form.title_en || null,
        description: form.description, description_en: form.description_en || null,
        price_usd: parseFloat(form.price_usd),
        price_usd_original: form.price_usd_original ? parseFloat(form.price_usd_original) : null,
        price_old_usd: form.price_old_usd ? parseFloat(form.price_old_usd) : null,
        category: form.category, supplier: form.supplier,
        supplier_url: form.supplier_url || null, supplier_sku: form.supplier_sku || null,
        stock: parseInt(form.stock) || 0, status: status || form.status,
        preventa_enabled: form.preventa_enabled, preventa_percent: parseInt(form.preventa_percent) || 30,
        preventa_launch_date: form.preventa_launch_date || null,
        meta_title: form.meta_title || null, meta_description: form.meta_description || null,
        seo_keywords: form.seo_keywords ? form.seo_keywords.split(',').map(s => s.trim()).filter(Boolean) : [],
        publisher: form.publisher || null, author: form.author || null,
        year: form.year ? parseInt(form.year) : null, isbn: form.isbn || null, franchise: form.franchise || null,
        images: form.images,
      };

      const url = isNew ? '/api/products' : `/api/products/${params.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();

      if (data.success) {
        toast.success(isNew ? 'Producto creado' : 'Producto actualizado');
        if (isNew) router.push('/admin/productos');
      } else { toast.error(data.error || 'Error al guardar'); }
    } catch { toast.error('Error al guardar'); }
    setSaving(false);
  }

  const AIBtn = ({ field, label }: { field: string; label?: string }) => (
    <button type="button" onClick={() => generateAI(field as any)} disabled={aiLoading === field}
      className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white disabled:opacity-50">
      {aiLoading === field ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <span>✦</span>}
      {label || 'IA'}
    </button>
  );

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition-colors">← Volver</button>
        <h1 className="font-display text-3xl text-gray-900">{isNew ? 'Nuevo Producto' : 'Editar Producto'}</h1>
      </div>

      {/* URL IMPORTER */}
      {isNew && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-blue-800 mb-3">🔗 Importar desde URL</h2>
          <p className="text-xs text-blue-600 mb-3">Soporta: Iron Studios, Panini Colombia, Midtown Comics, Amazon</p>
          <div className="flex gap-2">
            <input value={importUrl} onChange={e => setImportUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && importProduct()}
              placeholder="https://ironstudios.com/products/..." className="flex-1 bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
            <button onClick={importProduct} disabled={importing || !importUrl.trim()} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {importing ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Importando...</span> : 'Importar →'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT */}
        <div className="lg:col-span-2 space-y-5">

          {/* Title & Description */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Información</h3>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-medium text-gray-500">Título (ES) *</label>
                <AIBtn field="title" label="Mejorar título" />
              </div>
              <input value={form.title} onChange={e => set('title', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-red" placeholder="Ej: Batman Forever Minico — Iron Studios" />
            </div>

            <div className="mb-4">
              <label className="text-xs font-medium text-gray-500 block mb-1.5">Título en inglés (opcional)</label>
              <input value={form.title_en} onChange={e => set('title_en', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-red" />
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-medium text-gray-500">Descripción (ES)</label>
                <AIBtn field="description" label="Generar descripción ES" />
              </div>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={5} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-red resize-none" />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-medium text-gray-500">Descripción en inglés</label>
                <AIBtn field="description_en" label="Generar EN" />
              </div>
              <textarea value={form.description_en} onChange={e => set('description_en', e.target.value)} rows={3} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-red resize-none" />
            </div>
          </div>

          {/* Images */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Imágenes <span className="text-gray-400 font-normal">({form.images.length}/10)</span></h3>
              <div className="flex gap-2">
                <button type="button" onClick={addImageUrl} className="text-xs text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50">+ URL</button>
                <label className="text-xs text-green-600 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-50 cursor-pointer">
                  + Subir
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
              </div>
            </div>

            {form.images.length > 0 ? (
              <div className="grid grid-cols-5 gap-2">
                {form.images.map((img, i) => (
                  <div key={i} className={`relative aspect-square rounded-lg overflow-hidden border-2 ${img.is_primary ? 'border-red' : 'border-gray-200'}`}>
                    <img src={img.url} alt={img.alt} className="w-full h-full object-cover" onError={e => { (e.target as any).src = '/images/placeholder.jpg'; }} />
                    <button onClick={() => removeImage(i)} className="absolute top-1 right-1 w-5 h-5 bg-red/80 text-white rounded-full text-xs flex items-center justify-center hover:bg-red">×</button>
                    {img.is_primary && <span className="absolute bottom-1 left-1 text-[9px] bg-red text-white rounded px-1 font-bold">Principal</span>}
                  </div>
                ))}
                {form.images.length < 10 && (
                  <label className="aspect-square rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 cursor-pointer hover:border-gray-400 hover:text-gray-400 transition-colors text-2xl">
                    +<input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                )}
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400">
                <p className="text-3xl mb-2">🖼️</p>
                <p className="text-sm">Importa desde URL o sube imágenes</p>
              </div>
            )}
          </div>

          {/* SEO */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-gray-700">SEO</h3>
              <AIBtn field="seo" label="Optimizar SEO con IA" />
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Meta título</label>
                <input value={form.meta_title} onChange={e => set('meta_title', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-red" />
                <p className="text-[10px] text-gray-400 mt-0.5">{form.meta_title.length}/60 caracteres</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Meta descripción</label>
                <textarea value={form.meta_description} onChange={e => set('meta_description', e.target.value)} rows={2} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-red resize-none" />
                <p className="text-[10px] text-gray-400 mt-0.5">{form.meta_description.length}/160 caracteres</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Keywords (separadas por coma)</label>
                <input value={form.seo_keywords} onChange={e => set('seo_keywords', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-red" placeholder="batman, comics, dc, coleccionable" />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-4">

          {/* Price */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Precio</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Precio venta USD *</label>
                <input type="number" step="0.01" value={form.price_usd} onChange={e => set('price_usd', e.target.value)} className="w-full bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-yellow-400 font-semibold" />
                {form.price_usd && <p className="text-xs text-gray-400 mt-0.5">≈ ${priceCop} COP</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Precio original proveedor</label>
                <input type="number" step="0.01" value={form.price_usd_original} onChange={e => set('price_usd_original', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Precio tachado (opcional)</label>
                <input type="number" step="0.01" value={form.price_old_usd} onChange={e => set('price_old_usd', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" placeholder="Dejar vacío si no aplica" />
              </div>
            </div>
          </div>

          {/* Inventory */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Inventario</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Stock</label>
                <input type="number" min="0" value={form.stock} onChange={e => set('stock', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">SKU proveedor</label>
                <input value={form.supplier_sku} onChange={e => set('supplier_sku', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
              </div>
            </div>
          </div>

          {/* Preventa */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Preventa / Pago parcial</h3>
              <button onClick={() => set('preventa_enabled', !form.preventa_enabled)} className={`relative w-10 h-5 rounded-full transition-colors ${form.preventa_enabled ? 'bg-orange-400' : 'bg-gray-200'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${form.preventa_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {form.preventa_enabled && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">% a pagar hoy</label>
                  <input type="number" min="10" max="90" value={form.preventa_percent} onChange={e => set('preventa_percent', e.target.value)} className="w-full bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm outline-none" />
                  {form.price_usd && <p className="text-xs text-orange-600 mt-0.5">Cliente paga: ${(parseFloat(form.price_usd) * parseInt(form.preventa_percent) / 100).toFixed(2)} USD hoy</p>}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Fecha de lanzamiento</label>
                  <input type="date" value={form.preventa_launch_date} onChange={e => set('preventa_launch_date', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
                </div>
              </div>
            )}
          </div>

          {/* Organization */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Organización</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Categoría</label>
                <select value={form.category} onChange={e => set('category', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Proveedor</label>
                <select value={form.supplier} onChange={e => set('supplier', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
                  <option value="manual">Manual</option>
                  <option value="ironstudios">Iron Studios</option>
                  <option value="panini">Panini Colombia</option>
                  <option value="midtown">Midtown Comics</option>
                  <option value="amazon">Amazon</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Estado</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Editorial / Publisher</label>
                <input value={form.publisher} onChange={e => set('publisher', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Franquicia</label>
                <input value={form.franchise} onChange={e => set('franchise', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" placeholder="Batman, Spider-Man..." />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={() => save('draft')} disabled={saving} className="flex-1 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50">
              Borrador
            </button>
            <button onClick={() => save('published')} disabled={saving} className="flex-1 py-2.5 bg-red text-white text-sm font-semibold rounded-xl hover:bg-red-dark transition-colors disabled:opacity-50">
              {saving ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Guardando...</span> : 'Publicar →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
