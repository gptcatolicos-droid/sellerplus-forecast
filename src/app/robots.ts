import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin/', '/api/', '/checkout/'] },
    ],
    sitemap: 'https://latiendadecomics.com/sitemap.xml',
  };
}
