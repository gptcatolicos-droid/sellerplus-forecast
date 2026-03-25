import { MetadataRoute } from 'next';
import { query, ensureInit } from '@/lib/db';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://latiendadecomics.com';

  const staticPages = [
    { url: base, priority: 1.0, changeFrequency: 'daily' as const },
    { url: `${base}/catalogo`, priority: 0.9, changeFrequency: 'daily' as const },
    { url: `${base}/catalogo?categoria=comics_dc`, priority: 0.8, changeFrequency: 'weekly' as const },
    { url: `${base}/catalogo?categoria=comics_marvel`, priority: 0.8, changeFrequency: 'weekly' as const },
    { url: `${base}/catalogo?categoria=manga`, priority: 0.8, changeFrequency: 'weekly' as const },
    { url: `${base}/catalogo?categoria=figuras_iron_studios`, priority: 0.8, changeFrequency: 'weekly' as const },
    { url: `${base}/carrito`, priority: 0.5, changeFrequency: 'monthly' as const },
  ];

  try {
    await ensureInit();
    const r = await query(`SELECT slug, updated_at FROM products WHERE status = 'published' LIMIT 1000`);
    const productPages = r.rows.map((p: any) => ({
      url: `${base}/producto/${p.slug}`,
      lastModified: new Date(p.updated_at),
      priority: 0.7,
      changeFrequency: 'weekly' as const,
    }));
    return [...staticPages, ...productPages];
  } catch {
    return staticPages;
  }
}
