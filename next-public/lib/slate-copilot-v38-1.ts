export type SlateCopilotCandidateV38_1 = {
  displayName: string
  headline?: string
  currentTitle?: string
  currentEmployer?: string
  location?: string
  skills?: string[]
  provider?: string
  profileUrls?: Array<{ kind: string; url: string }>
  why?: string
  supportedEvidence?: number
}

export type SlateCopilotIntentV38_1 =
  | 'why_candidates'
  | 'contact_help'
  | 'profile_links'
  | 'evidence_filter'
  | 'slate_summary'

function compact(value: string | undefined) {
  return (value || '').trim()
}

function topCount(input: string, fallback = 3) {
  const match = input.match(/\btop\s+(\d{1,2})\b/i)
  return Math.max(1, Math.min(10, Number(match?.[1] || fallback)))
}

export function classifySlateCopilotIntentV38_1(input: string): SlateCopilotIntentV38_1 {
  const text = input.toLowerCase()
  if (/\bwhy\b|\bselected\b|\bsurfaced\b|\btop\s+\d+/.test(text)) return 'why_candidates'
  if (/\bcontact\b|\bemail\b|\bphone\b|\breveal\b|\benrich/.test(text)) return 'contact_help'
  if (/linkedin|github|stack\s*overflow|portfolio|website|profile\s+link/.test(text)) return 'profile_links'
  if (/stronger|evidence|must[- ]?have|requirement|which candidates|who has/.test(text)) return 'evidence_filter'
  return 'slate_summary'
}

export function buildSlateCopilotAnswerV38_1({
  input,
  candidates,
  selectedIndex,
}: {
  input: string
  candidates: SlateCopilotCandidateV38_1[]
  selectedIndex?: number | null
}): string {
  if (!candidates.length) return 'There is no retained slate to discuss yet. Run a people search first, then ask me about the results without starting another provider search.'

  const intent = classifySlateCopilotIntentV38_1(input)
  const selected = selectedIndex === null || selectedIndex === undefined ? undefined : candidates[selectedIndex]
  const focus = selected || candidates[0]

  if (intent === 'why_candidates') {
    const count = topCount(input)
    const rows = candidates.slice(0, count).map((candidate, index) => {
      const role = compact(candidate.currentTitle || candidate.headline) || 'professional profile'
      const employer = compact(candidate.currentEmployer)
      const reason = compact(candidate.why) || 'Retrieved by an executed source for this search; inspect the evidence before judging fit.'
      const supported = typeof candidate.supportedEvidence === 'number' ? ` ${candidate.supportedEvidence} explicit requirement signal${candidate.supportedEvidence === 1 ? '' : 's'} are currently supported.` : ''
      return `${index + 1}. ${candidate.displayName} — ${role}${employer ? ` at ${employer}` : ''}. ${reason}${supported}`
    })
    return `These are retrieval/review reasons, not hiring recommendations:\n${rows.join('\n')}`
  }

  if (intent === 'contact_help') {
    return `${focus.displayName} is selected. Use “Find contact” in Candidate 360 to request contact enrichment. Paid provider reads stay behind an explicit approval step, and returned availability is not treated as ownership, deliverability, or permission to contact.`
  }

  if (intent === 'profile_links') {
    const links = focus.profileUrls || []
    if (!links.length) return `No external profile URL was observed for ${focus.displayName} in the current source data. SourcingOS will not invent a LinkedIn, GitHub, Stack Overflow, portfolio, or website URL.`
    return `${focus.displayName} has these observed external profiles: ${links.map(item => `${item.kind}: ${item.url}`).join(' · ')}`
  }

  if (intent === 'evidence_filter') {
    const terms = input.toLowerCase().split(/[^a-z0-9+#.]+/).filter(term => term.length >= 3 && !['which','candidates','candidate','stronger','evidence','have','with','show','about','requirement','requirements'].includes(term))
    const ranked = candidates.map(candidate => {
      const haystack = [candidate.currentTitle, candidate.headline, candidate.currentEmployer, candidate.location, ...(candidate.skills || [])].filter(Boolean).join(' ').toLowerCase()
      const matches = terms.filter(term => haystack.includes(term))
      return { candidate, matches }
    }).filter(item => item.matches.length).sort((a, b) => b.matches.length - a.matches.length).slice(0, 8)
    if (!ranked.length) return 'I do not see that evidence in the current structured observations. That means “not evidenced,” not “does not have it.” Refine the search only if you want SourcingOS to run providers again.'
    return `Candidates with visible overlap in the current observations:\n${ranked.map((item, index) => `${index + 1}. ${item.candidate.displayName} — observed overlap: ${item.matches.join(', ')}`).join('\n')}`
  }

  return `This slate has ${candidates.length} retained candidate${candidates.length === 1 ? '' : 's'}. You can ask why people surfaced, compare visible requirement evidence, inspect external profile links, find contact info for a selected person, save candidates to the role, or export the retained slate. Asking here does not rerun providers; use Search / Refine when you intentionally want a new search.`
}
