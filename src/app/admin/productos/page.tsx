'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';

const SUPPLIER_LABELS: Record<string, string> = {
  ironstudios: 'Iron Studios', panini: 'Panini', midtown: 'Midtown', amazon: 'Amazon', manual: 'Manual',
};
const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  published: { label: 'Publicado', cls: 'bg-green-100 text-green-700' },
  draft:     { label: 'Borrador',  cls: 'bg-gray-100 text-gray-500' },
  archived:  { label: 'Archivado', cls: 'bg-yellow-100 text-yellow-700' },
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [supplier, setSupplier] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [bulkPercent, setBulkPercent] = useState('10');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20', status: status || 'all' });
    if (search) params.set('search', search);
    if (supplier) params.set('supplier', supplier);
    const res = await fetch(`/api/products?${params}`);
    const data = await res.json();
    if (data.success) { setProducts(data.data.items); setTotal(data.data.total); }
    setLoading(false);
  }, [page, search, supplier, status]);

  useEffect(() => { load(); }, [load]);

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSelected(prev => prev.size === products.length ? new Set() : new Set(products.map(p => p.id)));
  }

  async function bulkAction(action: string) {
    if (!selected.size && action !== 'price_update_all') { toast.error('Selecciona productos'); return; }

    if (action === 'delete') {
      if (!confirm(`¿Eliminar ${selected.size} producto(s)?`)) return;
      await fetch('/api/products/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', product_ids: Array.from(selected) }) });
      toast.success('Productos eliminados');
    } else if (action === 'price_update') {
      await fetch('/api/products/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'price_update', type: 'percentage', value: parseFloat(bulkPercent), apply_to: 'selected', product_ids: Array.from(selected) }) });
      toast.success(`Precios actualizados +${bulkPercent}%`);
    } else if (action === 'price_update_all') {
      if (!confirm(`¿Aumentar TODOS los productos en ${bulkPercent}%?`)) return;
      await fetch('/api/products/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'price_update', type: 'percentage', value: parseFloat(bulkPercent), apply_to: 'all' }) });
      toast.success(`Todos los precios actualizados +${bulkPercent}%`);
    } else if (action === 'publish') {
      await fetch('/api/products/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status_update', product_ids: Array.from(selected), status: 'published' }) });
      toast.success('Publicados');
    } else if (action === 'draft') {
      await fetch('/api/products/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status_update', product_ids: Array.from(selected), status: 'draft' }) });
      toast.success('Pasados a borrador');
    }

    setSelected(new Set());
    load();
  }

  async function togglePreventa(id: string, current: boolean) {
    await fetch(`/api/products/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preventa_enabled: !current }) });
    load();
  }

  async function quickUpdatePrice(id: string, value: string) {
    const price = parseFloat(value);
    if (isNaN(price) || price <= 0) return;
    await fetch(`/api/products/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ price_usd: price }) });
    toast.success('Precio actualizado');
    load();
  }

  async function quickUpdateStock(id: string, value: string) {
    const stock = parseInt(value);
    if (isNaN(stock) || stock < 0) return;
    await fetch(`/api/products/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stock }) });
    toast.success('Stock actualizado');
    load();
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gray-900">Productos</h1>
          <p className="text-gray-400 text-sm mt-0.5">{total} productos en total</p>
        </div>
        <Link href="/admin/productos/nuevo" className="px-4 py-2.5 bg-red text-white text-sm font-semibold rounded-xl hover:bg-red-dark transition-colors">
          + Importar / Nuevo
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar..." className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-red w-52" />
        <select value={supplier} onChange={e => { setSupplier(e.target.value); setPage(1); }} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
          <option value="">Todos los proveedores</option>
          {Object.entries(SUPPLIER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
          <option value="">Todos los estados</option>
          <option value="published">Publicado</option>
          <option value="draft">Borrador</option>
          <option value="archived">Archivado</option>
        </select>
      </div>

      {/* Bulk toolbar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-orange-50 border border-orange-200 rounded-xl flex-wrap">
          <span className="text-sm font-medium text-orange-800">{selected.size} seleccionados</span>
          <div className="flex items-center gap-1.5">
            <input value={bulkPercent} onChange={e => setBulkPercent(e.target.value)} className="w-16 bg-white border border-orange-200 rounded-lg px-2 py-1.5 text-sm outline-none" type="number" />
            <span className="text-xs text-orange-700">%</span>
            <button onClick={() => bulkAction('price_update')} className="px-3 py-1.5 bg-white border border-orange-200 text-orange-700 text-xs font-medium rounded-lg hover:bg-orange-50">Subir precio</button>
          </div>
          <button onClick={() => bulkAction('publish')} className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50">Publicar</button>
          <button onClick={() => bulkAction('draft')} className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50">Borrador</button>
          <button onClick={() => bulkAction('delete')} className="px-3 py-1.5 bg-red/10 text-red text-xs font-medium rounded-lg hover:bg-red/20 ml-auto">Eliminar</button>
        </div>
      )}

      {/* Bulk price ALL */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-gray-500">Incrementar todos los precios:</span>
        <input value={bulkPercent} onChange={e => setBulkPercent(e.target.value)} className="w-16 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none" type="number" />
        <span className="text-xs text-gray-400">%</span>
        <button onClick={() => bulkAction('price_update_all')} className="px-3 py-1.5 bg-brand-black text-white text-xs font-medium rounded-lg hover:bg-gray-800">Aplicar a todos</button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full admin-table">
          <thead>
            <tr>
              <th className="w-10"><input type="checkbox" onChange={toggleAll} checked={selected.size === products.length && products.length > 0} /></th>
              <th className="w-[35%]">Producto</th>
              <th>Proveedor</th>
              <th>Precio USD</th>
              <th>Stock</th>
              <th>Estado</th>
              <th>Preventa</th>
              <th className="text-right pr-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">Cargando...</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">No hay productos</td></tr>
            ) : products.map(p => {
              const s = STATUS_LABELS[p.status] || { label: p.status, cls: 'bg-gray-100 text-gray-500' };
              return (
                <tr key={p.id}>
                  <td><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} /></td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-11 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
                        {p.images?.[0] ? <img src={p.images[0].url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-sm">📚</div>}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 line-clamp-1">{p.title}</p>
                        <p className="text-xs text-gray-400">{p.supplier_sku || p.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{SUPPLIER_LABELS[p.supplier] || p.supplier}</span></td>
                  <td>
                    <input
                      defaultValue={p.price_usd.toFixed(2)}
                      onBlur={e => quickUpdatePrice(p.id, e.target.value)}
                      className="w-20 bg-yellow-50 border border-yellow-200 rounded-lg px-2 py-1 text-sm text-right outline-none focus:border-yellow-400"
                    />
                  </td>
                  <td>
                    <input
                      defaultValue={p.stock}
                      onBlur={e => quickUpdateStock(p.id, e.target.value)}
                      type="number" min="0"
                      className={`w-16 border rounded-lg px-2 py-1 text-sm text-center outline-none ${p.stock <= 2 ? 'bg-red/5 border-red/30 text-red' : p.stock <= 5 ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-gray-50 border-gray-200'}`}
                    />
                  </td>
                  <td><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span></td>
                  <td>
                    <button
                      onClick={() => togglePreventa(p.id, p.preventa_enabled)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${p.preventa_enabled ? 'bg-orange-400' : 'bg-gray-200'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${p.preventa_enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </td>
                  <td className="text-right pr-4">
                    <Link href={`/admin/productos/${p.id}`} className="text-xs text-blue-600 hover:underline mr-3">Editar</Link>
                    <button onClick={async () => { if (confirm('¿Eliminar?')) { await fetch(`/api/products/${p.id}`, { method: 'DELETE' }); toast.success('Eliminado'); load(); } }} className="text-xs text-red hover:underline">Eliminar</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        {total > 20 && (
          <div className="flex justify-center gap-1 py-4 border-t border-gray-100">
            {Array.from({ length: Math.ceil(total / 20) }, (_, i) => (
              <button key={i} onClick={() => setPage(i + 1)} className={`w-8 h-8 rounded-lg text-sm transition-colors ${page === i + 1 ? 'bg-red text-white' : 'hover:bg-gray-100 text-gray-600'}`}>{i + 1}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
