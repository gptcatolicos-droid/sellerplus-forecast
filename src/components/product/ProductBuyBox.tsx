'use client';
import { useState } from 'react';
import { useCart } from '@/hooks/useCart';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import type { Product } from '@/types';

export default function ProductBuyBox({ product }: { product: Product }) {
  const [qty, setQty] = useState(1);
  const [usePreventa, setUsePreventa] = useState(false);
  const { addItem } = useCart();
  const router = useRouter();

  const sellingPrice = usePreventa
    ? product.price_usd * (product.preventa_percent / 100)
    : product.price_usd;

  const sellingCop = usePreventa
    ? Math.round(product.price_cop * (product.preventa_percent / 100))
    : product.price_cop;

  function handleAddToCart() {
    addItem(product, qty, usePreventa);
    toast.success('Agregado al carrito');
  }

  function handleBuyNow() {
    addItem(product, qty, usePreventa);
    router.push('/checkout');
  }

  const inStock = product.stock > 0;
  const stockLabel = product.stock === 0 ? 'Agotado' : product.stock <= 5 ? `¡Solo ${product.stock} disponibles!` : 'En stock';
  const stockColor = product.stock === 0 ? 'text-red' : product.stock <= 5 ? 'text-orange-500' : 'text-green-600';

  return (
    <div>
      {/* Category badge */}
      <div className="mb-3">
        <span className="text-xs font-semibold bg-gray-100 text-gray-500 rounded-full px-3 py-1 uppercase tracking-wider">
          {product.publisher || product.category}
        </span>
      </div>

      {/* Title */}
      <h1 className="font-display text-4xl leading-tight mb-3 text-gray-900">
        {product.title}
      </h1>

      {/* Meta */}
      {(product.author || product.year) && (
        <p className="text-sm text-gray-400 mb-4">
          {[product.author, product.franchise, product.year].filter(Boolean).join(' · ')}
        </p>
      )}

      {/* PREVENTA OPTION */}
      {product.preventa_enabled && inStock && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-orange-800">📦 Opción de Preventa disponible</p>
              <p className="text-xs text-orange-600 mt-1 leading-relaxed">
                Paga solo el {product.preventa_percent}% hoy y el resto cuando llegue el producto.
                {product.preventa_launch_date && ` Lanzamiento: ${new Date(product.preventa_launch_date).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}.`}
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
              <div
                onClick={() => setUsePreventa(!usePreventa)}
                className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer ${usePreventa ? 'bg-orange-500' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${usePreventa ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
            </label>
          </div>
          {usePreventa && (
            <div className="mt-3 pt-3 border-t border-orange-200">
              <div className="flex justify-between text-sm">
                <span className="text-orange-700">Pagas hoy ({product.preventa_percent}%)</span>
                <span className="font-bold text-orange-800">${(product.price_usd * product.preventa_percent / 100).toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-orange-600">Al recibir el producto</span>
                <span className="text-orange-600">${(product.price_usd * (1 - product.preventa_percent / 100)).toFixed(2)} USD</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Price block */}
      <div className="bg-gray-50 rounded-xl p-4 mb-5">
        <div className="flex items-baseline gap-3">
          <span className="text-4xl font-light text-gray-900">
            ${sellingPrice.toFixed(2)} <span className="text-xl">USD</span>
          </span>
          {product.price_old_usd && !usePreventa && (
            <span className="text-base text-gray-400 line-through">${product.price_old_usd.toFixed(2)}</span>
          )}
        </div>
        <p className="text-sm text-gray-400 mt-1">
          ≈ ${sellingCop.toLocaleString('es-CO')} COP
          <span className="text-xs ml-1">(tasa aplicada automáticamente)</span>
        </p>
        <p className="text-xs text-green-600 mt-2">
          🚚 Envío Colombia: $5 USD · Internacional: $30 USD
        </p>
      </div>

      {/* Stock */}
      <p className={`text-sm font-medium ${stockColor} mb-4`}>
        {stockLabel}
      </p>

      {/* Quantity */}
      <div className="flex items-center gap-4 mb-4">
        <span className="text-sm font-medium text-gray-700">Cantidad</span>
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setQty(Math.max(1, qty - 1))}
            className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 transition-colors text-lg"
          >−</button>
          <span className="w-10 text-center text-sm font-semibold">{qty}</span>
          <button
            onClick={() => setQty(Math.min(product.stock || 99, qty + 1))}
            className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 transition-colors text-lg"
          >+</button>
        </div>
      </div>

      {/* CTA buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleAddToCart}
          disabled={!inStock}
          className="flex-1 py-3.5 px-4 border-2 border-brand-black text-brand-black font-semibold rounded-xl hover:bg-brand-black hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
        >
          + Agregar al carrito
        </button>
        <button
          onClick={handleBuyNow}
          disabled={!inStock}
          className="flex-1 py-3.5 px-4 bg-red text-white font-semibold rounded-xl hover:bg-red-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
        >
          {usePreventa ? `Reservar por $${(product.price_usd * product.preventa_percent / 100).toFixed(2)} →` : 'Comprar ahora →'}
        </button>
      </div>

      {/* Security badges */}
      <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
        <span>🔒 Pago seguro</span>
        <span>🏦 MercadoPago</span>
        <span>📦 Envío LATAM</span>
      </div>
    </div>
  );
}
