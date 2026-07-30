import { createHash, createHmac } from 'node:crypto'

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'mc_cid', 'mc_eid',
])

export function normalizeWhitespace(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ')
}

export function normalizeName(value: string): string {
  return normalizeWhitespace(value)
    .toLocaleLowerCase('und')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[^\p{L}\p{N}' -]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** A comparison-only folded form. Never display or persist as the person's name. */
export function foldForComparison(value: string): string {
  return normalizeName(value)
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/['-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeHandle(value: string): string {
  return normalizeWhitespace(value)
    .replace(/^@+/, '')
    .toLocaleLowerCase('und')
    .replace(/[^\p{L}\p{N}._-]+/gu, '')
}

export function normalizeOrganization(value: string): string {
  return foldForComparison(value)
    .replace(/\b(incorporated|inc|llc|ltd|limited|corp|corporation|company|co)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeLocation(value: string): string {
  return foldForComparison(value)
    .replace(/\b(united states of america|united states|usa)\b/g, 'us')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeDomain(value: string): string {
  const candidate = value.includes('://') ? value : `https://${value}`
  try {
    return new URL(candidate).hostname.toLocaleLowerCase('en-US').replace(/^www\./, '').replace(/\.$/, '')
  } catch {
    return ''
  }
}

export function normalizeProfileUrl(value: string): string {
  const candidate = value.includes('://') ? value : `https://${value}`
  try {
    const url = new URL(candidate)
    url.protocol = 'https:'
    url.hostname = url.hostname.toLocaleLowerCase('en-US').replace(/^www\./, '')
    url.hash = ''
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLocaleLowerCase('en-US'))) url.searchParams.delete(key)
    }
    url.pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/'
    const search = url.searchParams.toString()
    return `${url.origin}${url.pathname}${search ? `?${search}` : ''}`
  } catch {
    return ''
  }
}

export function normalizeEmail(value: string): string {
  const trimmed = value.normalize('NFKC').trim().toLocaleLowerCase('en-US')
  const at = trimmed.lastIndexOf('@')
  if (at <= 0 || at === trimmed.length - 1) return ''

  let local = trimmed.slice(0, at)
  let domain = normalizeDomain(trimmed.slice(at + 1))
  if (!domain) return ''

  // Provider-specific only. Plus tags and dots are meaningful for many domains.
  if (domain === 'googlemail.com') domain = 'gmail.com'
  if (domain === 'gmail.com') {
    local = local.split('+', 1)[0].replace(/\./g, '')
  }

  if (!local || !/^[^\s@]+$/.test(local)) return ''
  return `${local}@${domain}`
}

export function normalizeOrcid(value: string): string {
  const compact = value.toUpperCase().replace(/^HTTPS?:\/\/(WWW\.)?ORCID\.ORG\//, '').replace(/[^0-9X]/g, '')
  if (!/^\d{15}[\dX]$/.test(compact)) return ''
  let total = 0
  for (const char of compact.slice(0, 15)) total = (total + Number(char)) * 2
  const remainder = total % 11
  const result = (12 - remainder) % 11
  const check = result === 10 ? 'X' : String(result)
  if (check !== compact.at(-1)) return ''
  return `${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8, 12)}-${compact.slice(12)}`
}

export function stableHash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

/** Use an application secret or owner-scoped key. Never hash sensitive values unsalted. */
export function sensitiveHash(value: string, secret: string): string {
  if (!secret) throw new Error('sensitiveHash requires a non-empty secret')
  return createHmac('sha256', secret).update(value, 'utf8').digest('hex')
}

export function uniqueNormalized(values: string[], normalize: (value: string) => string): string[] {
  return [...new Set(values.map(normalize).filter(Boolean))]
}
