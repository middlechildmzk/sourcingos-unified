import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  const privateRoutes = ['/admin/', '/app/', '/login/', '/auth/', '/api/', '/jobs/admin/']
  const publicRoutes = [
    '/',
    '/candidate-search/',
    '/tools/',
    '/guides/',
    '/training/',
    '/blog/',
    '/methodology/',
    '/trust/',
    '/data-sources/',
    '/sources/',
    '/jobs/',
  ]

  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: privateRoutes },
      { userAgent: 'GPTBot', allow: publicRoutes, disallow: privateRoutes },
      { userAgent: 'ChatGPT-User', allow: publicRoutes, disallow: privateRoutes },
      { userAgent: 'ClaudeBot', allow: publicRoutes, disallow: privateRoutes },
      { userAgent: 'PerplexityBot', allow: publicRoutes, disallow: privateRoutes },
      { userAgent: 'Google-Extended', allow: publicRoutes, disallow: privateRoutes },
      { userAgent: 'CCBot', allow: publicRoutes, disallow: privateRoutes },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
