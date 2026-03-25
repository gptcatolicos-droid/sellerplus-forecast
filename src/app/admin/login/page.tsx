'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        router.push('/admin');
      } else {
        setError(data.error || 'Credenciales invalidas');
      }
    } catch {
      setError('Error de conexion. Intenta de nuevo.');
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 16, padding: 36, width: '100%', maxWidth: 400, boxShadow: '0 4px 24px rgba(0,0,0,.07)' }}>
        
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/logo.webp" alt="La Tienda de Comics" style={{ height: 44, margin: '0 auto 12px' }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 4 }}>Panel Admin</h1>
          <p style={{ fontSize: 13, color: '#888' }}>Ingresa tus credenciales</p>
        </div>

        <form onSubmit={login}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@latiendadecomics.com"
              required
              style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e0e0e0', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#f9f9f9', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Contrasena
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e0e0e0', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#f9f9f9', boxSizing: 'border-box' }}
            />
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#dc2626', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: 14, background: loading ? '#999' : '#CC0000', border: 'none', borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
          >
            {loading ? 'Entrando...' : 'Entrar al admin'}
          </button>
        </form>
      </div>
    </div>
  );
}
