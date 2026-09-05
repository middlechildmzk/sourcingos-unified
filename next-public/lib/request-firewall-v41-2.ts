export type RequestFirewallDecisionV41_2 =
  | { action: 'allow' }
  | { action: 'deny'; status: 404 | 405; reason: string }

const BLOCKED_METHODS = new Set(['CONNECT', 'TRACE', 'TRACK'])

const BLOCKED_EXACT_PATHS = new Set([
  '/.env',
  '/.env.local',
  '/.env.production',
  '/.git/config',
  '/.git/HEAD',
  '/wp-config.php',
  '/phpinfo.php',
  '/server-status',
  '/server-info',
])

const BLOCKED_PREFIXES = [
  '/.git/',
  '/.svn/',
  '/.hg/',
  '/.idea/',
  '/.vscode/',
  '/vendor/phpunit/',
]

function normalizePathname(pathname: string): string {
  const raw = String(pathname || '/').trim() || '/'
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export function requestFirewallDecisionV41_2(input: {
  method: string
  pathname: string
}): RequestFirewallDecisionV41_2 {
  const method = String(input.method || 'GET').toUpperCase()
  if (BLOCKED_METHODS.has(method)) {
    return { action: 'deny', status: 405, reason: 'unsupported_method' }
  }

  const pathname = normalizePathname(input.pathname)
  const lower = pathname.toLowerCase()

  // Keep standards-based public discovery/validation paths available.
  if (lower === '/.well-known' || lower.startsWith('/.well-known/')) {
    return { action: 'allow' }
  }

  if (
    lower.includes('\0')
    || lower.includes('\\')
    || lower.split('/').some(segment => segment === '..')
  ) {
    return { action: 'deny', status: 404, reason: 'malformed_path' }
  }

  if (BLOCKED_EXACT_PATHS.has(lower) || BLOCKED_PREFIXES.some(prefix => lower.startsWith(prefix))) {
    return { action: 'deny', status: 404, reason: 'sensitive_probe_path' }
  }

  return { action: 'allow' }
}
