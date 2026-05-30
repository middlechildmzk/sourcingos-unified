// ─────────────────────────────────────────────────────────────────────────────
// lib/safe-redirect.ts — Open-redirect prevention helper.
//
// Problem: `value.startsWith('/')` is insufficient.
//   //evil.com       starts with /  → browser treats as protocol-relative URL
//   /\evil.com       starts with /  → browser may normalise to //evil.com
//   /path?url=://x   starts with /  → payload in query string
//
// This helper accepts ONLY safe relative paths (starts with /, not // or ://).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns `value` if it is a safe relative path, otherwise returns `fallback`.
 *
 * Safe means:
 *   - starts with exactly one /
 *   - does not start with //
 *   - does not contain ://
 *
 * @example
 *   safeRelativePath('/app/candidate-search') // → '/app/candidate-search'
 *   safeRelativePath('//evil.com')            // → fallback
 *   safeRelativePath('https://evil.com')      // → fallback
 *   safeRelativePath(null)                    // → fallback
 */
export function safeRelativePath(
  value: string | null | undefined,
  fallback = '/app/candidate-search'
): string {
  if (!value) return fallback
  if (!value.startsWith('/')) return fallback
  if (value.startsWith('//')) return fallback
  if (value.includes('://')) return fallback
  return value
}
