export type EvidenceSpan = {
  sourceTextRef: string
  start: number
  end: number
  text: string
}

function isWordish(value: string | undefined): boolean {
  return Boolean(value && /[a-z0-9]/i.test(value))
}

/**
 * Finds a term only when its alphanumeric edges are bounded. This deliberately
 * prevents short recruiting/search terms from matching inside unrelated words
 * (for example IAM inside Miami).
 */
export function boundedTermIndex(sourceText: string, term: string, fromIndex = 0): number {
  const needle = term.trim()
  if (!needle) return -1
  const sourceLower = sourceText.toLowerCase()
  const needleLower = needle.toLowerCase()
  let cursor = Math.max(0, fromIndex)

  while (cursor <= sourceLower.length - needleLower.length) {
    const index = sourceLower.indexOf(needleLower, cursor)
    if (index === -1) return -1

    const before = index > 0 ? sourceText[index - 1] : undefined
    const afterIndex = index + needle.length
    const after = afterIndex < sourceText.length ? sourceText[afterIndex] : undefined
    const first = needle[0]
    const last = needle[needle.length - 1]
    const startBounded = !isWordish(first) || !isWordish(before)
    const endBounded = !isWordish(last) || !isWordish(after)

    if (startBounded && endBounded) return index
    cursor = index + Math.max(1, needle.length)
  }

  return -1
}

export function containsBoundedTerm(sourceText: string, term: string): boolean {
  return boundedTermIndex(sourceText, term) >= 0
}

export function findBoundedTextSpan(sourceText: string, terms: string[], sourceTextRef: string): EvidenceSpan | undefined {
  const candidates = Array.from(new Set(terms.map(term => term.trim()).filter(Boolean)))
  let best: { index: number; term: string } | undefined

  for (const term of candidates) {
    const index = boundedTermIndex(sourceText, term)
    if (index < 0) continue
    if (!best || index < best.index || (index === best.index && term.length > best.term.length)) {
      best = { index, term }
    }
  }

  if (!best) return undefined
  const end = best.index + best.term.length
  return {
    sourceTextRef,
    start: best.index,
    end,
    text: sourceText.slice(best.index, end),
  }
}

export function sourceProfileTextRef(sourceProfileId: string): string {
  return `source_profile:${sourceProfileId}:raw_text`
}

export function spanMatchesSource(sourceText: string, span: EvidenceSpan): boolean {
  if (!Number.isInteger(span.start) || !Number.isInteger(span.end)) return false
  if (span.start < 0 || span.end <= span.start || span.end > sourceText.length) return false
  return sourceText.slice(span.start, span.end) === span.text
}
