'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function CuponesPage() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [form, setForm] = useState({ code: '', type: 'percentage', value: '', max_uses: '', min_order_usd: '', expires_at: '' });

  async function load() {
    const res = await fetch('/api/coupons');
    const data = await res.json();
    if (data.success) setCoupons(data.data);
  }

  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code || !form.value) { toast.error('Código y valor son requeridos'); return; }
    const res = await fetch('/api/coupons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: form.code.toUpperCase(), type: form.type, value: parseFloat(form.value), max_uses: form.max_uses ? parseInt(form.max_uses) : null, min_order_usd: form.min_order_usd ? parseFloat(form.min_order_usd) : null, expires_at: form.expires_at || null }) });
    const data = await res.json();
    if (data.success) { toast.success('Cupón creado'); setForm({ code: '', type: 'percentage', value: '', max_uses: '', min_order_usd: '', expires_at: '' }); load(); }
    else toast.error(data.error || 'Error');
  }

  async function toggle(id: string, active: boolean) {
    await fetch('/api/coupons', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, active: !active }) });
    load();
  }

  async function del(id: string) {
    if (!confirm('¿Eliminar cupón?')) return;
    await fetch(`/api/coupons?id=${id}`, { method: 'DELETE' });
    toast.success('Eliminado'); load();
  }

  return (
    <div className="p-8">
      <h1 className="font-display text-3xl text-gray-900 mb-6">Cupones</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full admin-table">
            <thead><tr><th>Código</th><th>Tipo</th><th>Valor</th><th>Usos</th><th>Vence</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {coupons.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">Sin cupones</td></tr>
              ) : coupons.map(c => (
                <tr key={c.id}>
                  <td className="font-bold text-sm font-mono">{c.code}</td>
                  <td className="text-xs text-gray-500 capitalize">{c.type}</td>
                  <td className="text-sm font-semibold">{c.type === 'percentage' ? `${c.value}%` : c.type === 'fixed' ? `$${c.value}` : 'Envío gratis'}</td>
                  <td className="text-sm text-gray-500">{c.uses_count}{c.max_uses ? ` / ${c.max_uses}` : ''}</td>
                  <td className="text-xs text-gray-400">{c.expires_at ? new Date(c.expires_at).toLocaleDateString('es-CO') : '—'}</td>
                  <td>
                    <button onClick={() => toggle(c.id, c.active)} className={`relative w-9 h-5 rounded-full transition-colors ${c.active ? 'bg-green-500' : 'bg-gray-200'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${c.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </td>
                  <td><button onClick={() => del(c.id)} className="text-xs text-red hover:underline">Eliminar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Create form */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 h-fit">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Crear cupón</h2>
          <form onSubmit={create} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Código *</label>
              <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="COMICS10" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm uppercase font-mono outline-none focus:border-red" required />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Tipo</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
                <option value="percentage">% descuento</option>
                <option value="fixed">Monto fijo USD</option>
                <option value="free_shipping">Envío gratis</option>
              </select>
            </div>
            {form.type !== 'free_shipping' && (
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">{form.type === 'percentage' ? 'Porcentaje (%)' : 'Monto ($)'} *</label>
                <input type="number" step="0.01" value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-red" required />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Límite de usos</label>
              <input type="number" value={form.max_uses} onChange={e => setForm(p => ({ ...p, max_uses: e.target.value }))} placeholder="Ilimitado" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Vencimiento</label>
              <input type="date" value={form.expires_at} onChange={e => setForm(p => ({ ...p, expires_at: e.target.value }))} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
            <button type="submit" className="w-full py-2.5 bg-red text-white text-sm font-semibold rounded-xl hover:bg-red-dark transition-colors">
              Crear cupón
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
