'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function ConfiguracionPage() {
  const [refreshingRates, setRefreshingRates] = useState(false);

  async function refreshRates() {
    setRefreshingRates(true);
    const res = await fetch('/api/exchange-rate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const data = await res.json();
    if (data.success) toast.success(`Tasas actualizadas: 1 USD = $${data.data.usd_to_cop.toLocaleString()} COP`);
    else toast.error(data.error || 'Error');
    setRefreshingRates(false);
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="font-display text-3xl text-gray-900 mb-8">Configuración</h1>

      <div className="space-y-5">

        {/* MercadoPago */}
        <Section title="💳 MercadoPago">
          <p className="text-xs text-gray-400 mb-4">
            Genera tus credenciales en{' '}
            <a href="https://www.mercadopago.com.co/developers/es/docs/getting-started" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              developers.mercadopago.com
            </a>
          </p>
          <Field label="Access Token (MP_ACCESS_TOKEN)" type="password" placeholder="APP_USR-..." env="MP_ACCESS_TOKEN" />
          <Field label="Public Key (MP_PUBLIC_KEY)" type="password" placeholder="APP_USR-..." env="MP_PUBLIC_KEY" />
          <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-xs text-green-700">✓ Webhook configurado: <code className="font-mono bg-green-100 px-1 rounded">/api/payments/webhook</code></p>
          </div>
        </Section>

        {/* Email */}
        <Section title="📧 Email (Resend)">
          <p className="text-xs text-gray-400 mb-4">
            Cuenta gratuita en <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">resend.com</a> — 3,000 emails/mes gratis
          </p>
          <Field label="API Key (RESEND_API_KEY)" type="password" placeholder="re_xxxxx..." env="RESEND_API_KEY" />
          <Field label="Email remitente (EMAIL_FROM)" placeholder="pedidos@latiendadecomics.com" env="EMAIL_FROM" />
          <button onClick={async () => { const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'test' }) }); toast('Verifica tu .env y reinicia el servidor para aplicar cambios'); }} className="mt-2 text-xs text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50">
            Probar configuración
          </button>
        </Section>

        {/* Shipping */}
        <Section title="🚚 Tarifas de envío">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Envío Colombia 🇨🇴 (USD)</label>
              <input type="number" defaultValue="5" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-red" readOnly />
              <p className="text-[10px] text-gray-400 mt-0.5">Cambia en .env: SHIPPING_COLOMBIA=5</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Envío Internacional (USD)</label>
              <input type="number" defaultValue="30" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-red" readOnly />
              <p className="text-[10px] text-gray-400 mt-0.5">Cambia en .env: SHIPPING_INTL=30</p>
            </div>
          </div>
        </Section>

        {/* Exchange rates */}
        <Section title="💱 Tasas de cambio">
          <p className="text-xs text-gray-400 mb-4">Las tasas se usan para convertir precios USD a COP automáticamente en todos los productos.</p>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">Última actualización: hoy</p>
            <button onClick={refreshRates} disabled={refreshingRates} className="px-4 py-2 bg-brand-black text-white text-xs font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2">
              {refreshingRates && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              Actualizar tasas
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Al actualizar, se recalculan los precios COP de todos los productos automáticamente.</p>
        </Section>

        {/* Claude AI */}
        <Section title="🤖 Claude AI">
          <p className="text-xs text-gray-400 mb-4">
            API Key de <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">console.anthropic.com</a>
          </p>
          <Field label="Anthropic API Key (ANTHROPIC_API_KEY)" type="password" placeholder="sk-ant-..." env="ANTHROPIC_API_KEY" />
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">Modelo: claude-sonnet-4-20250514 · Uso aproximado: $5–15 USD/mes</p>
          </div>
        </Section>

        {/* Env reminder */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-yellow-800 mb-1">⚠️ Importante: Variables de entorno</p>
          <p className="text-xs text-yellow-700 leading-relaxed">
            Todas las credenciales se configuran en el archivo <code className="font-mono bg-yellow-100 px-1 rounded">.env</code> del servidor.
            Copia <code className="font-mono bg-yellow-100 px-1 rounded">.env.example</code> a <code className="font-mono bg-yellow-100 px-1 rounded">.env</code> y completa todos los valores antes del lanzamiento.
            Después de cambiar el .env, reinicia el servidor con <code className="font-mono bg-yellow-100 px-1 rounded">pm2 restart all</code>.
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-800 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, type = 'text', placeholder, env }: { label: string; type?: string; placeholder?: string; env: string }) {
  return (
    <div className="mb-3">
      <label className="text-xs font-medium text-gray-500 block mb-1">{label}</label>
      <input type={type} placeholder={placeholder} readOnly
        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none font-mono" />
      <p className="text-[10px] text-gray-400 mt-0.5">Variable: <code className="font-mono">{env}</code> en archivo .env</p>
    </div>
  );
}
