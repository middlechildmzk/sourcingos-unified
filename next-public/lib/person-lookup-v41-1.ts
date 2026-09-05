export type KnownPersonLookupKindV41_1 = 'email' | 'profile_url' | 'name' | 'query'

export type KnownPersonLookupInputV41_1 = {
  kind: KnownPersonLookupKindV41_1
  normalized: string
  exact: boolean
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NAME_TOKEN_RE = /^[\p{L}][\p{L}'’.\-]*$/u
const NAME_CONTEXT_TOKENS = new Set(['at', 'from', 'in', 'near', 'with', 'for', 'of'])

export function classifyKnownPersonLookupV41_1(value: string): KnownPersonLookupInputV41_1 {
  const trimmed = String(value || '').trim()
  if (EMAIL_RE.test(trimmed)) {
    return { kind: 'email', normalized: trimmed.toLowerCase(), exact: true }
  }

  try {
    const url = new URL(trimmed)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      url.hash = ''
      return { kind: 'profile_url', normalized: url.toString(), exact: true }
    }
  } catch {
    // Not a URL; continue to bounded name detection.
  }

  const tokens = trimmed.split(/\s+/).filter(Boolean)
  const hasContextMarker = tokens.some(token => NAME_CONTEXT_TOKENS.has(token.toLowerCase()))
  if (!hasContextMarker && tokens.length >= 2 && tokens.length <= 4 && tokens.every(token => NAME_TOKEN_RE.test(token))) {
    return { kind: 'name', normalized: trimmed.replace(/\s+/g, ' '), exact: false }
  }

  return { kind: 'query', normalized: trimmed, exact: false }
}

export function liveKnownPersonSearchPayloadV41_1(value: string) {
  const input = classifyKnownPersonLookupV41_1(value)

  // Exact identifiers must never silently degrade into generic people search.
  // A provider-specific reverse-identifier adapter can be added later; until
  // then an exact miss is truthful zero-match rather than unrelated people.
  if (input.exact) return null

  return {
    query: input.normalized,
    ...(input.kind === 'name' ? { names: [input.normalized] } : {}),
    limit: 12,
    highFreshness: false,
  }
}

export function exactIdentifierQueryParamV41_1(value: string): string | undefined {
  const input = classifyKnownPersonLookupV41_1(value)
  return input.exact ? input.normalized : undefined
}
