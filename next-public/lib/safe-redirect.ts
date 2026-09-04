// ─────────────────────────────────────────────────────────────────────────────
// lib/safe-redirect.ts — Open-redirect prevention helper.
//
// Accept only same-origin path/query/hash destinations. Protocol-relative,
// backslash-normalized, encoded-slash and absolute URLs fall back safely.
// ─────────────────────────────────────────────────────────────────────────────

const SAFE_REDIRECT_ORIGIN = 'https://sourcingos.invalid'

/** Returns a normalized safe relative destination, or `fallback`. */
export function safeRelativePath(
  value: string | null | undefined,
  fallback = '/app/search'
): string {
  if (!value || !value.startsWith('/')) return fallback
  if (value.startsWith('//') || value.includes('\\')) return fallback
  if (/%2f|%5c/i.test(value)) return fallback
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback

  try {
    const parsed = new URL(value, SAFE_REDIRECT_ORIGIN)
    if (parsed.origin !== SAFE_REDIRECT_ORIGIN) return fallback
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}
