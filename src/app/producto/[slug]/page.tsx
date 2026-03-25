export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { query, ensureInit } from '@/lib/db';
import { parseProduct } from '../../api/products/route';
import Navbar from '@/components/layout/Navbar';
import ProductBuyBox from '@/components/product/ProductBuyBox';
import ProductImages from '@/components/product/ProductImages';
import AIChat from '@/components/ai/AIChat';

interface PageProps { params: { slug: string } }

async function getProduct(slug: string) {
  await ensureInit();
  const r = await query(`
    SELECT p.*, json_agg(json_build_object('id', pi.id, 'url', pi.url, 'alt', pi.alt, 'is_primary', pi.is_primary, 'sort_order', pi.sort_order)
      ORDER BY pi.is_primary DESC, pi.sort_order ASC) FILTER (WHERE pi.id IS NOT NULL) as images_json
    FROM products p LEFT JOIN product_images pi ON pi.product_id = p.id
    WHERE (p.slug = $1 OR p.id = $1) AND p.status = 'published' GROUP BY p.id
  `, [slug]);
  if (!r.rows.length) return null;
  return parseProduct(r.rows[0]);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const product = await getProduct(params.slug);
  if (!product) return { title: 'Producto no encontrado' };
  return {
    title: product.meta_title || `${product.title} | La Tienda de Comics`,
    description: product.meta_description || product.description.slice(0, 160),
    openGraph: { title: product.title, description: product.description.slice(0, 200), images: product.images[0] ? [{ url: product.images[0].url, alt: product.images[0].alt }] : [] },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const product = await getProduct(params.slug);
  if (!product) notFound();

  const relatedRes = await query(`
    SELECT p.*, json_agg(json_build_object('id', pi.id, 'url', pi.url, 'alt', pi.alt, 'is_primary', pi.is_primary, 'sort_order', pi.sort_order)
      ORDER BY pi.is_primary DESC) FILTER (WHERE pi.id IS NOT NULL) as images_json
    FROM products p LEFT JOIN product_images pi ON pi.product_id = p.id
    WHERE p.status = 'published' AND p.id != $1 AND (p.category = $2 OR p.franchise = $3)
    GROUP BY p.id ORDER BY RANDOM() LIMIT 4
  `, [product.id, product.category, product.franchise || '']);
  const related = relatedRes.rows.map(parseProduct);

  const jsonLd = { '@context': 'https://schema.org', '@type': 'Product', name: product.title, description: product.description, image: product.images.map(i => i.url), offers: { '@type': 'Offer', price: product.price_usd, priceCurrency: 'USD', availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' } };

  return (
    <>
      <Navbar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="max-w-7xl mx-auto px-6 py-3 text-sm text-gray-400 flex gap-1.5 flex-wrap">
        <a href="/" className="hover:text-gray-600">Inicio</a> /
        <a href={`/catalogo?categoria=${product.category}`} className="hover:text-gray-600 capitalize">{product.category}</a> /
        <span className="text-gray-700 font-medium line-clamp-1">{product.title}</span>
      </div>
      <div className="max-w-7xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16">
          <ProductImages images={product.images} title={product.title} />
          <div>
            <ProductBuyBox product={product} />
            <div className="mt-6"><AIChat product={{ title: product.title, description: product.description.slice(0, 400), price: `$${product.price_usd.toFixed(2)} USD` }} compact={false} /></div>
          </div>
        </div>
        <div className="mt-12 max-w-3xl">
          <h2 className="font-display text-2xl mb-4">DESCRIPCIÓN</h2>
          <p className="text-gray-600 leading-relaxed text-base whitespace-pre-line">{product.description}</p>
          {(product.author || product.publisher || product.year || product.isbn) && (
            <div className="mt-8 border-t border-gray-100 pt-6">
              <h3 className="font-semibold text-gray-900 mb-4 text-sm">Detalles del producto</h3>
              <dl className="grid grid-cols-2 gap-y-3 gap-x-8 text-sm">
                {product.publisher && <><dt className="text-gray-400">Editorial</dt><dd className="text-gray-700 font-medium">{product.publisher}</dd></>}
                {product.author && <><dt className="text-gray-400">Autor</dt><dd className="text-gray-700 font-medium">{product.author}</dd></>}
                {product.year && <><dt className="text-gray-400">Año</dt><dd className="text-gray-700 font-medium">{product.year}</dd></>}
                {product.franchise && <><dt className="text-gray-400">Franquicia</dt><dd className="text-gray-700 font-medium">{product.franchise}</dd></>}
              </dl>
            </div>
          )}
        </div>
        {related.length > 0 && (
          <div className="mt-14">
            <h2 className="font-display text-2xl mb-6">TAMBIÉN TE PUEDE GUSTAR</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {related.map(p => {
                const img = p.images.find(i => i.is_primary) || p.images[0];
                return (
                  <a key={p.id} href={`/producto/${p.slug}`} className="group border border-gray-100 rounded-xl overflow-hidden hover:shadow-sm transition-shadow">
                    <div className="aspect-[2/3] bg-gray-50 relative overflow-hidden">
                      {img ? <img src={img.url} alt={img.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /> : <div className="w-full h-full flex items-center justify-center text-4xl">📚</div>}
                    </div>
                    <div className="p-3"><p className="text-sm font-medium line-clamp-2">{p.title}</p><p className="text-sm font-semibold text-red mt-1">${p.price_usd.toFixed(2)} USD</p></div>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
