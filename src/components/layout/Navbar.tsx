'use client';
import Link from 'next/link';
import { useCart } from '@/hooks/useCart';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function Navbar() {
  const { count } = useCart();
  const [lang, setLang] = useState('ES');
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { href: '/catalogo?categoria=comics', label: 'Cómics' },
    { href: '/catalogo?categoria=libros', label: 'Libros' },
    { href: '/catalogo?categoria=figuras', label: 'Figuras' },
    { href: '/catalogo', label: 'Catálogo' },
  ];

  return (
    <nav className={`sticky top-0 z-50 bg-brand-black transition-shadow ${scrolled ? 'shadow-lg' : ''}`}>
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 bg-red rounded-lg flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="4" rx="1" fill="white" opacity=".3"/>
              <rect x="3" y="7" width="18" height="14" rx="1" fill="white" opacity=".12"/>
              <path d="M5 14 Q7 12 9 14 Q11 16 13 14" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
            </svg>
          </div>
          <span className="font-display text-xl text-white tracking-wider">
            La Tienda de <span className="text-red">Comics</span>
          </span>
        </Link>

        {/* Links */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname.startsWith(link.href.split('?')[0])
                  ? 'text-white bg-white/10'
                  : 'text-white/70 hover:text-white hover:bg-white/8'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          <select
            value={lang}
            onChange={e => setLang(e.target.value)}
            className="bg-white/10 text-white/70 text-xs px-2.5 py-1.5 rounded-lg border-none outline-none cursor-pointer"
          >
            <option value="ES">ES</option>
            <option value="EN">EN</option>
          </select>

          <button
            onClick={() => router.push('/catalogo')}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 text-white/70 hover:text-white hover:bg-white/15 transition-colors"
            aria-label="Buscar"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </button>

          <Link
            href="/carrito"
            className="relative w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 text-white/70 hover:text-white hover:bg-white/15 transition-colors"
            aria-label="Carrito"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 2 3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
            {count > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {count > 9 ? '9+' : count}
              </span>
            )}
          </Link>
        </div>
      </div>
    </nav>
  );
}
