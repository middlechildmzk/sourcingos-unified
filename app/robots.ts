import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  const privateRoutes = ['/admin/', '/app/', '/login/', '/auth/', '/api/', '/jobs/admin/', '/go/']
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: privateRoutes }],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
