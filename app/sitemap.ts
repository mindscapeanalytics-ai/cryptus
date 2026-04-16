import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://rsiq.mindscapeanalytics.com';

  const routes = [
    '',
    '/terminal',
    '/login',
    '/register',
    '/about',
    '/services',
    '/subscription',
    '/guide',
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: (route === '' || route === '/terminal' ? 'always' : 'weekly') as any,
    priority: route === '' ? 1 : route === '/terminal' ? 0.9 : 0.7,
  }));
}
