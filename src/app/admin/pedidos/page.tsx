'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';

const STATUS_OPTS = [
  { value: 'pending',    label: 'Pendiente',   cls: 'bg-orange-100 text-orange-700' },
  { value: 'processing', label: 'Procesando',  cls: 'bg-blue-100 text-blue-700' },
  { value: 'shipped',    label: 'Despachado',  cls: 'bg-purple-100 text-purple-700' },
  { value: 'delivered',  label: 'Entregado',   cls: 'bg-green-100 text-green-700' },
  { value: 'cancelled',  label: 'Cancelado',   cls: 'bg-red/10 text-red' },
];
const STATUS_MAP = Object.fromEntries(STATUS_OPTS.map(s => [s.value, s]));

export default function OrdersListPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: '20' });
    if (status) p.set('status', status);
    if (search) p.set('search', search);
    const res = await fetch(`/api/orders?${p}`);
    const data = await res.json();
    if (data.success) { setOrders(data.data.items); setTotal(data.data.total); }
    setLoading(false);
  }, [page, status, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gray-900">Pedidos</h1>
          <p className="text-gray-400 text-sm mt-0.5">{total} pedidos en total</p>
        </div>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar pedido o email..." className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-red w-56" />
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
          <option value="">Todos los estados</option>
          {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full admin-table">
          <thead>
            <tr>
              <th>Pedido</th><th>Cliente</th><th>Productos</th>
              <th>Total</th><th>Envío</th><th>Estado</th><th>Tracking</th><th>Fecha</th><th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-10 text-gray-400">Cargando...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-10 text-gray-400">Sin pedidos</td></tr>
            ) : orders.map(o => {
              const s = STATUS_MAP[o.status] || { label: o.status, cls: 'bg-gray-100 text-gray-500' };
              return (
                <tr key={o.id} className="cursor-pointer" onClick={() => router.push(`/admin/pedidos/${o.id}`)}>
                  <td className="font-semibold text-red text-sm">{o.order_number}</td>
                  <td>
                    <p className="text-sm font-medium text-gray-900">{o.customer.name}</p>
                    <p className="text-xs text-gray-400">{o.customer.email} · {o.customer.country}</p>
                  </td>
                  <td className="text-sm text-gray-600">{o.items.length} item(s)</td>
                  <td className="font-semibold text-sm">${o.total_usd.toFixed(2)}</td>
                  <td className="text-xs text-gray-500">{o.shipping_zone === 'colombia' ? '🇨🇴 $5' : '🌎 $30'}</td>
                  <td><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span></td>
                  <td className="text-xs text-blue-600">{o.tracking_number || '—'}</td>
                  <td className="text-xs text-gray-400">{new Date(o.created_at).toLocaleDateString('es-CO')}</td>
                  <td><Link href={`/admin/pedidos/${o.id}`} onClick={e => e.stopPropagation()} className="text-xs text-blue-600 hover:underline">Ver →</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
