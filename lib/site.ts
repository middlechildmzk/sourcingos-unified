// Single canonical production site URL used by metadata, robots, and sitemap.
// If Vercel still has an old *.vercel.app env value, refuse it for public SEO.
const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
export const siteUrl = configuredSiteUrl && !configuredSiteUrl.includes('vercel.app')
  ? configuredSiteUrl
  : 'https://www.getsourcingos.com'
