import 'server-only'

const RESTRICTED_DEEP_REFRESH_HOSTS = [
  'linkedin.com',
  'facebook.com',
  'instagram.com',
  'x.com',
  'twitter.com',
  'tiktok.com',
]

function isPrivateIpv4(host: string): boolean {
  return host === '0.0.0.0'
    || /^127\./.test(host)
    || /^10\./.test(host)
    || /^192\.168\./.test(host)
    || /^169\.254\./.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
}

export function publicDeepRefreshUrlV36_16(raw: string): string {
  const url = new URL(raw)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only public HTTP(S) URLs can be refreshed.')
  if (url.username || url.password) throw new Error('Credential-bearing URLs are not allowed for live-web refresh.')
  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  const local = host === 'localhost'
    || host === '::1'
    || isPrivateIpv4(host)
    || host.endsWith('.internal')
    || host.endsWith('.local')
  if (local) throw new Error('Private or local URLs are not allowed for live-web refresh.')
  if (RESTRICTED_DEEP_REFRESH_HOSTS.some(blocked => host === blocked || host.endsWith(`.${blocked}`))) {
    throw new Error('Deep refresh is not allowed for this login-gated/social host. Use public search results and approved structured profile providers instead.')
  }
  return url.toString()
}

export function restrictedDeepRefreshHostsV36_16(): string[] {
  return [...RESTRICTED_DEEP_REFRESH_HOSTS]
}
