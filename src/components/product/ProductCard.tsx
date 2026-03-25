'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/hooks/useCart';
import toast from 'react-hot-toast';
import type { Product } from '@/types';

interface Props {
  product: Product;
  showAddToCart?: boolean;
}

export default function ProductCard({ product, showAddToCart = true }: Props) {
  const { addItem } = useCart();
  const primaryImage = product.images.find(i => i.is_primary) || product.images[0];

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem(product, 1, false);
    toast.success(`"${product.title.slice(0, 30)}..." agregado al carrito`);
  };

  const badge = product.preventa_enabled
    ? { label: 'Preventa', cls: 'bg-blue-600' }
    : product.stock === 0
    ? { label: 'Agotado', cls: 'bg-gray-500' }
    : null;

  return (
    <Link href={`/producto/${product.slug}`} className="group block">
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
        {/* Image */}
        <div className="aspect-[2/3] bg-gray-50 relative overflow-hidden">
          {primaryImage ? (
            <Image
              src={primaryImage.url}
              alt={primaryImage.alt || product.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 768px) 50vw, 20vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br from-gray-100 to-gray-200">
              📚
            </div>
          )}
          {badge && (
            <span className={`absolute top-2 left-2 ${badge.cls} text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider`}>
              {badge.label}
            </span>
          )}
          {product.price_old_usd && (
            <span className="absolute top-2 right-2 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              -{Math.round((1 - product.price_usd / product.price_old_usd) * 100)}%
            </span>
          )}
        </div>

        {/* Info */}
        <div className="p-3">
          <p className="text-xs text-gray-400 mb-1">{product.publisher || product.supplier}</p>
          <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug mb-2">
            {product.title}
          </h3>

          <div className="flex items-baseline gap-1.5 mb-2">
            <span className="text-base font-semibold text-gray-900">
              ${product.price_usd.toFixed(2)} USD
            </span>
            {product.price_old_usd && (
              <span className="text-xs text-gray-400 line-through">${product.price_old_usd.toFixed(2)}</span>
            )}
          </div>

          <p className="text-xs text-gray-400 mb-2.5">
            ≈ ${product.price_cop.toLocaleString('es-CO')} COP
          </p>

          {showAddToCart && (
            <button
              onClick={handleAdd}
              disabled={product.stock === 0}
              className="w-full py-2 text-xs font-semibold rounded-lg bg-brand-black text-white hover:bg-red transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {product.stock === 0 ? 'Agotado' : '+ Agregar al carrito'}
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
