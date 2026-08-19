/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
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
    ]
  },
}
export default nextConfig
