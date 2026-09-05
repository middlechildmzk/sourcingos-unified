import 'server-only'
import { isLocalOrPrivateHostV36_16 } from '@/lib/agent-data/public-web-policy-v36-16'

/**
 * Hosts that require login/subscription to view the actual document. A URL
 * observed at one of these hosts is real public-web evidence that the
 * document likely exists, but SourcingOS does not bypass the login/paywall
 * to fetch it -- so these stay metadata-only leads for a human to open
 * themselves.
 */
export const RESUME_METADATA_ONLY_HOSTS_V40_5I = new Set([
  'scribd.com', 'www.scribd.com',
  'slideshare.net', 'www.slideshare.net',
  'researchgate.net', 'www.researchgate.net',
  'academia.edu', 'www.academia.edu',
  'issuu.com', 'www.issuu.com',
])

const RESTRICTED_LOGIN_HOSTS_V40_5I = new Set([
  'linkedin.com', 'www.linkedin.com',
  'facebook.com', 'www.facebook.com',
  'instagram.com', 'www.instagram.com',
  'x.com', 'www.x.com', 'twitter.com', 'www.twitter.com',
  'tiktok.com', 'www.tiktok.com',
])

function isRedirectWrapperUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  // Search-engine click-tracking/redirect wrappers carry no independent
  // evidentiary value and can hide the true destination from downstream
  // safety checks, so they are dropped at discovery rather than followed.
  if (host === 'google.com' && url.pathname === '/url') return true
  if (host === 'bing.com' && url.pathname.startsWith('/ck/')) return true
  if (host === 'duckduckgo.com' && url.pathname === '/l/') return true
  if (host === 'l.facebook.com' || host === 'lm.facebook.com') return true
  if (host === 'out.reddit.com') return true
  return false
}

function hasSignedAccessParam(url: URL): boolean {
  const keys = new Set([...url.searchParams.keys()].map(key => key.toLowerCase()))
  return keys.has('x-amz-signature') || keys.has('x-amz-credential')
    || keys.has('signature') || keys.has('sig')
    || keys.has('token') || keys.has('access_token')
}

/**
 * Accept only legitimate public HTTP/HTTPS URLs. Rejects localhost, private
 * IPs, credentials embedded in the URL, non-http(s) schemes (so a data: or
 * javascript: value is rejected by construction -- URL parsing plus the
 * protocol allowlist below is what enforces this), and known search-engine
 * redirect/click-tracking junk. Returns the normalized URL, or null when the
 * URL is unsafe or unparsable.
 */
export function normalizeResumeCvUrlV40_5I(raw: string): string | null {
  let url: URL
  try {
    url = new URL(String(raw || '').trim().replace(/[),.;]+$/, ''))
  } catch {
    return null
  }
  if (!['http:', 'https:'].includes(url.protocol)) return null
  if (url.username || url.password) return null
  if (isLocalOrPrivateHostV36_16(url.hostname)) return null
  if (isRedirectWrapperUrl(url)) return null
  url.hash = ''
  return url.toString()
}

export function extractUrlsFromTextV40_5I(text: string): string[] {
  // Provider search responses can be plain text, Markdown, or a
  // JSON-serialized payload. JSON strings commonly escape slashes
  // (https:\/\/) and ampersands (&). Normalize those transport escapes
  // before URL extraction so legitimate public result URLs are not silently
  // discarded. This does not decode redirect targets, enumerate private
  // resources, or expand shortened links; it only recovers URLs already
  // present in the public search response.
  const normalizedText = String(text || '')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u003d/gi, '=')
    .replace(/\\\//g, '/')
  const matches = normalizedText.match(/https?:\/\/[^\s<>"'\])}]+/gi) || []
  return Array.from(new Set(matches.map(normalizeResumeCvUrlV40_5I).filter((url): url is string => Boolean(url))))
}

export type ResumeCvUrlClassificationV40_5I =
  | 'direct_document'
  | 'resume_page'
  | 'metadata_only'
  | 'irrelevant'

/**
 * Classifies an already-safety-checked URL for the Resume/CV lane:
 *  - direct_document: a public .pdf/.doc/.docx/.rtf or an equivalent raw-file
 *    host (Drive/Docs, S3, raw.githubusercontent.com).
 *  - resume_page: a public HTML page whose host/path clearly signals a
 *    resume/CV/portfolio page.
 *  - metadata_only: useful indexed evidence where retrieval is restricted or
 *    access is uncertain (login-gated host, or a URL carrying a signed/token
 *    access parameter such as a pre-signed S3 link or a Drive share token).
 *  - irrelevant: none of the above; not a Resume/CV signal on its own.
 * This function does not decide fetch eligibility for identity -- that is a
 * separate, conservative check performed once a document's text is in hand.
 */
export function classifyResumeCvUrlV40_5I(rawUrl: string): ResumeCvUrlClassificationV40_5I {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return 'irrelevant'
  }
  const host = url.hostname.toLowerCase()
  const bareHost = host.replace(/^www\./, '')
  const value = rawUrl.toLowerCase()

  if (RESUME_METADATA_ONLY_HOSTS_V40_5I.has(host) || RESTRICTED_LOGIN_HOSTS_V40_5I.has(bareHost)) return 'metadata_only'
  // Uncertain-access cloud links (pre-signed S3/GCS, Drive share tokens,
  // password-protected Dropbox links) are downgraded rather than aggressively
  // fetched, per SourcingOS URL safety policy.
  if (hasSignedAccessParam(url) && host !== 'raw.githubusercontent.com') return 'metadata_only'

  if (/\.(pdf|docx?|rtf)(?:[?#]|$)/i.test(value)) return 'direct_document'
  if (host === 'drive.google.com' || host === 'docs.google.com') return 'direct_document'
  if (host.endsWith('.s3.amazonaws.com') || host === 's3.amazonaws.com') return 'direct_document'
  if (host === 'raw.githubusercontent.com') return 'direct_document'

  if (/(^|[\/_-])(resume|curriculum[-_ ]?vitae|cv)([\/_\-.?&#]|$)/i.test(value)) return 'resume_page'

  return 'irrelevant'
}

export function resumeCvUrlIsFetchEligibleV40_5I(classification: ResumeCvUrlClassificationV40_5I): boolean {
  return classification === 'direct_document' || classification === 'resume_page'
}
