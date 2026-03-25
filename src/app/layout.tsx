import type { Metadata } from 'next';
import { DM_Sans, Oswald } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' });
const oswald = Oswald({ subsets: ['latin'], variable: '--font-oswald', weight: ['400','500','600','700'] });

export const metadata: Metadata = {
  title: 'La Tienda de Comics IA — Cómics, Figuras y Manga Colombia',
  description: 'La mejor tienda de cómics DC, Marvel, Manga y figuras Iron Studios de Colombia. Busca con IA. Envíos a toda Colombia y LATAM.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://latiendadecomics.onrender.com'),
  icons: {
    icon: '/favicon.webp',
    apple: '/favicon.webp',
    shortcut: '/favicon.webp',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/favicon.webp" />
        <link rel="apple-touch-icon" href="/favicon.webp" />
      </head>
      <body className={`${dmSans.variable} ${oswald.variable}`}
        style={{ fontFamily: 'var(--font-dm-sans), sans-serif', margin: 0, padding: 0, background: '#fff' }}>
        {children}
      </body>
    </html>
  );
}
