import 'server-only'

/**
 * OpenAlex access policy — August 2026.
 *
 * OpenAlex retired the old polite-pool / mailto access pattern in 2026 and
 * requires an API key for production use. SourcingOS fails visibly when the
 * key is absent instead of returning an empty market and pretending the source
 * successfully searched.
 */

export class OpenAlexCredentialError extends Error {
  constructor() {
    super('OpenAlex is unavailable because OPENALEX_API_KEY is not configured. Add a free OpenAlex API key before using this source.')
    this.name = 'OpenAlexCredentialError'
  }
}

export function openAlexApiKey(): string {
  const key = String(process.env.OPENALEX_API_KEY || '').trim()
  if (!key) throw new OpenAlexCredentialError()
  return key
}

export function openAlexApiUrl(
  path: string,
  params: Record<string, string | number | undefined> = {},
): string {
  const url = new URL(path.startsWith('http') ? path : `https://api.openalex.org${path.startsWith('/') ? path : `/${path}`}`)
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue
    url.searchParams.set(key, String(value))
  }
  url.searchParams.set('api_key', openAlexApiKey())
  // Explicit regression boundary: do not revive the retired polite-pool field.
  url.searchParams.delete('mailto')
  return url.toString()
}

export function isOpenAlexCredentialError(error: unknown): error is OpenAlexCredentialError {
  return error instanceof OpenAlexCredentialError || (error instanceof Error && error.name === 'OpenAlexCredentialError')
}
