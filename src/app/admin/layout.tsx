'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '📊', exact: true },
  { href: '/admin/productos', label: 'Productos', icon: '📦' },
  { href: '/admin/importar', label: 'Importar', icon: '📥' },
  { href: '/admin/pedidos', label: 'Pedidos', icon: '🛒', badge: true },
  { href: '/admin/cupones', label: 'Cupones', icon: '🎟️' },
  { href: '/admin/diseno', label: 'Diseno', icon: '🎨' },
  { href: '/admin/configuracion', label: 'Config', icon: '⚙️' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [pendingOrders, setPendingOrders] = useState(0);

  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    // Don't check auth on login page
    if (isLoginPage) {
      setChecking(false);
      return;
    }
    fetch('/api/auth')
      .then(r => {
        if (!r.ok) router.replace('/admin/login');
        else setChecking(false);
      })
      .catch(() => router.replace('/admin/login'));
  }, [isLoginPage]);

  useEffect(() => {
    if (!checking && !isLoginPage) {
      fetch('/api/orders?status=pending&limit=1')
        .then(r => r.json())
        .then(d => { if (d.success) setPendingOrders(d.data?.total || 0); })
        .catch(() => {});
    }
  }, [checking, isLoginPage]);

  async function logout() {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    router.replace('/admin/login');
  }

  // Login page — render without sidebar
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (checking) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #e0e0e0', borderTopColor: '#CC0000', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ fontSize: 13, color: '#888' }}>Verificando acceso...</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f7', display: 'flex' }}>
      {/* Sidebar */}
      <aside style={{ width: 200, background: '#fff', borderRight: '1px solid #e8e8e8', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e8e8e8' }}>
          <img src="/logo.webp" alt="Admin" style={{ height: 28, objectFit: 'contain' }} />
        </div>
        <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
          {NAV.map(item => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href) && item.href !== '/admin';
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 10px', borderRadius: 8, marginBottom: 2,
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                color: isActive ? '#CC0000' : '#555',
                background: isActive ? '#fff0f0' : 'transparent',
                textDecoration: 'none',
              }}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && pendingOrders > 0 && (
                  <span style={{ marginLeft: 'auto', background: '#CC0000', color: 'white', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10 }}>
                    {pendingOrders}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div style={{ padding: '12px 8px', borderTop: '1px solid #e8e8e8' }}>
          <button onClick={logout} style={{ width: '100%', padding: '9px 10px', background: 'none', border: 'none', borderRadius: 8, fontSize: 13, color: '#888', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}>
            <span>🚪</span><span>Salir</span>
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </main>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
