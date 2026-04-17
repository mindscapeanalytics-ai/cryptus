import { MetadataRoute } from 'next';
import { getTopSymbols } from '@/lib/screener-service';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://rsiq.mindscapeanalytics.com';

  // Fetch top 100 symbols for Programmatic SEO (pSEO) indexing
  let symbols: string[] = [];
  try {
    symbols = await getTopSymbols(100);
  } catch (error) {
    console.error('Sitemap symbol fetch failed:', error);
  }

  const symbolEntries: MetadataRoute.Sitemap = symbols.map((symbol) => ({
    url: `${baseUrl}/symbol/${symbol.toLowerCase()}`,
    lastModified: new Date(),
    changeFrequency: 'always',
    priority: 0.8,
  }));

  const routes = [
    '',
    '/terminal',
    '/subscription',
    '/about',
    '/services',
    '/guide',
    '/legal/terms',
    '/legal/privacy',
    '/login',
    '/register',
  ];

  const staticEntries: MetadataRoute.Sitemap = routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: (route === '' || route === '/terminal' ? 'always' : 'weekly') as any,
    priority: route === '' ? 1.0 : route === '/terminal' ? 0.9 : route.startsWith('/legal') ? 0.3 : 0.7,
  }));

  return [...staticEntries, ...symbolEntries];
}
