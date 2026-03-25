export const dynamic = 'force-dynamic';
import { query, ensureInit } from '@/lib/db';
import Link from 'next/link';

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending:    { label: 'Pendiente',  cls: 'bg-orange-100 text-orange-700' },
  processing: { label: 'Procesando', cls: 'bg-blue-100 text-blue-700' },
  shipped:    { label: 'Despachado', cls: 'bg-purple-100 text-purple-700' },
  delivered:  { label: 'Entregado',  cls: 'bg-green-100 text-green-700' },
  cancelled:  { label: 'Cancelado',  cls: 'bg-red/10 text-red' },
};

export default async function AdminDashboard() {
  await ensureInit();

  const [salesToday, salesMonth, pendingOrders, totalProducts, recentOrders, lowStock] = await Promise.all([
    query(`SELECT COALESCE(SUM(total_usd),0) as s FROM orders WHERE DATE(created_at)=CURRENT_DATE AND status NOT IN ('cancelled','refunded')`).then(r => parseFloat(r.rows[0].s)),
    query(`SELECT COALESCE(SUM(total_usd),0) as s FROM orders WHERE DATE_TRUNC('month',created_at)=DATE_TRUNC('month',NOW()) AND status NOT IN ('cancelled','refunded')`).then(r => parseFloat(r.rows[0].s)),
    query(`SELECT COUNT(*) as c FROM orders WHERE status IN ('pending','processing')`).then(r => parseInt(r.rows[0].c)),
    query(`SELECT COUNT(*) as c FROM products WHERE status='published'`).then(r => parseInt(r.rows[0].c)),
    query(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 8`).then(r => r.rows),
    query(`SELECT id, slug, title, stock FROM products WHERE stock > 0 AND stock <= 5 AND status='published' ORDER BY stock ASC LIMIT 6`).then(r => r.rows),
  ]);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-gray-900">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Resumen de La Tienda de Comics</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Ventas hoy', value: `$${salesToday.toFixed(0)} USD`, color: 'text-green-600' },
          { label: 'Ventas del mes', value: `$${salesMonth.toFixed(0)} USD`, color: 'text-blue-600' },
          { label: 'Pedidos pendientes', value: pendingOrders, color: pendingOrders > 0 ? 'text-red' : 'text-gray-900' },
          { label: 'Productos activos', value: totalProducts, color: 'text-gray-900' },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-gray-100 rounded-xl p-5">
            <p className="text-xs text-gray-400 font-medium mb-2">{stat.label}</p>
            <p className={`text-3xl font-light ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-900 text-sm">Pedidos recientes</h2>
            <Link href="/admin/pedidos" className="text-xs text-red font-medium hover:underline">Ver todos</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentOrders.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sin pedidos aún</p>
            ) : recentOrders.map((o: any) => {
              const s = STATUS_LABELS[o.status] || { label: o.status, cls: 'bg-gray-100 text-gray-600' };
              return (
                <Link key={o.id} href={`/admin/pedidos/${o.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{o.order_number}</p>
                    <p className="text-xs text-gray-400">{o.customer_name} · {o.customer_country}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                    <p className="text-sm font-semibold text-gray-900">${parseFloat(o.total_usd).toFixed(2)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-900 text-sm">⚠️ Poco stock</h2>
            <Link href="/admin/productos" className="text-xs text-red font-medium hover:underline">Ver productos</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {lowStock.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Todo el stock está bien ✓</p>
            ) : lowStock.map((p: any) => (
              <Link key={p.id} href={`/admin/productos/${p.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                <p className="text-sm text-gray-700 line-clamp-1 flex-1 mr-4">{p.title}</p>
                <span className={`text-sm font-bold ${p.stock <= 2 ? 'text-red' : 'text-orange-500'}`}>{p.stock} unid.</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
