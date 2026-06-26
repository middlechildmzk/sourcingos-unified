import type { MetadataRoute } from 'next'
import { siteUrl } from './layout'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin/', '/app/', '/login/'] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
