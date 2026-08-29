/** @type {import('next').NextConfig} */
const cspReportOnly = [
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

const nextConfig = {
  trailingSlash: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy-Report-Only', value: cspReportOnly },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
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
