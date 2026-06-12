import type { MetadataRoute } from 'next'

const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://sourcingos-unified.vercel.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin/', '/app/', '/login/'] }],
    sitemap: `${base}/sitemap.xml`,
  }
}
