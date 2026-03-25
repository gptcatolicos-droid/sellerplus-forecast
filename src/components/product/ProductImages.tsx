'use client';
import { useState } from 'react';
import Image from 'next/image';
import type { ProductImage } from '@/types';

export default function ProductImages({ images, title }: { images: ProductImage[]; title: string }) {
  const [active, setActive] = useState(0);
  const current = images[active];

  if (!images.length) {
    return (
      <div className="aspect-square bg-gray-50 rounded-2xl flex items-center justify-center text-8xl border border-gray-100">
        📚
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="aspect-square bg-gray-50 rounded-2xl overflow-hidden relative border border-gray-100">
        <Image
          src={current.url}
          alt={current.alt || title}
          fill
          className="object-contain p-4"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
        />
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActive(i)}
              className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                i === active ? 'border-red' : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              <Image
                src={img.url}
                alt={img.alt || `${title} ${i + 1}`}
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
