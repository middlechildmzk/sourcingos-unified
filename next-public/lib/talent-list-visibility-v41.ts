import type { EntityKind } from '@/lib/source-types'

export type TalentListEmptyReason = 'no_records' | 'no_search_match' | 'all_withheld'

export type TalentListVisibility = {
  /** Rows on the current page that resolved to a person and are rendered. */
  personCount: number
  /**
   * Rows the Candidate Graph returned for this page that did not resolve to a
   * person. Talent lists people only, but withholding a row must be disclosed:
   * a page of nothing but non-person rows previously rendered "No people yet."
   * while the header metric counted them, which reads to a recruiter as data
   * loss rather than as a classification outcome.
   */
  withheldCount: number
  /** True when the page rendered nothing but the graph did return rows. */
  hasWithheldOnly: boolean
  emptyReason: TalentListEmptyReason | null
}

/**
 * Personhood is never inferred here. This resolver does not reclassify anything;
 * it only decides what the recruiter is told about rows Talent will not render.
 */
export function talentListVisibilityV41(
  candidates: ReadonlyArray<{ entityKind: EntityKind }>,
  options: { searchApplied?: boolean } = {},
): TalentListVisibility {
  const personCount = candidates.filter(candidate => candidate.entityKind === 'person').length
  const withheldCount = candidates.length - personCount
  const hasWithheldOnly = personCount === 0 && withheldCount > 0

  let emptyReason: TalentListEmptyReason | null = null
  if (personCount === 0) {
    if (withheldCount > 0) emptyReason = 'all_withheld'
    else if (options.searchApplied) emptyReason = 'no_search_match'
    else emptyReason = 'no_records'
  }

  return { personCount, withheldCount, hasWithheldOnly, emptyReason }
}
