/** @type {import('next').NextConfig} */
const productionCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "media-src 'self'",
  'upgrade-insecure-requests',
].join('; ')

// Preview/local remains report-only and permits the framework/debug tooling that
// may require eval. Production uses the enforced policy above.
const previewCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https:",
  "worker-src 'self' blob:",
  'upgrade-insecure-requests',
].join('; ')

const isVercelProduction = process.env.VERCEL_ENV === 'production'

const nextConfig = {
  trailingSlash: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: isVercelProduction ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only',
            value: isVercelProduction ? productionCsp : previewCsp,
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
          ...(isVercelProduction
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
            : []),
        ],
      },
    ]
  },
  async redirects() {
    return [
      {
        source: '/linkedin-recruiter-alternative',
        destination: '/blog/linkedin-recruiter-alternatives/',
        permanent: true,
      },
      {
        source: '/linkedin-recruiter',
        destination: '/blog/linkedin-recruiter-alternatives/',
        permanent: true,
      },
      {
        source: '/blog/open-web-sourcing-stack',
        destination: '/blog/linkedin-recruiter-alternatives/',
        permanent: true,
      },
      {
        source: '/blog/sourcing-tool-stack-for-agency-recruiters',
        destination: '/blog/linkedin-recruiter-alternatives/',
        permanent: true,
      },
      {
        source: '/blog/sourcing-for-founders-and-small-teams',
        destination: '/blog/linkedin-recruiter-alternatives/',
        permanent: true,
      },
      {
        source: '/blog/hard-to-fill-role-intake-template',
        destination: '/blog/senior-sourcer-role-intake/',
        permanent: true,
      },
      {
        source: '/blog/hiring-manager-calibration-questions',
        destination: '/blog/senior-sourcer-role-intake/',
        permanent: true,
      },
      {
        source: '/blog/govcon-cleared-sourcing-market-map',
        destination: '/blog/where-to-find-cleared-candidates/',
        permanent: true,
      },
      {
        source: '/blog/source-profile-evidence-ledger',
        destination: '/blog/candidate-360-profile-template/',
        permanent: true,
      },
      {
        source: '/blog/contact-enrichment-compliance-for-recruiters',
        destination: '/blog/best-contact-finders-for-recruiters-2026/',
        permanent: true,
      },
    ]
  },
}
export default nextConfig
