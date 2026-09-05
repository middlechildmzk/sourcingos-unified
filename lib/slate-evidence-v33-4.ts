export type SlateEvidenceState = 'supported' | 'contradicted' | 'unknown' | 'needs_verification'

export type SlateEvidenceClaim = {
  source: string
  sourceUrl?: string
  detail: string
  spanText?: string
}

export type SlateRequirementEvidence = {
  requirementText: string
  tier: 'must_have' | 'preferred' | 'disqualifier'
  state: SlateEvidenceState
  evidence: SlateEvidenceClaim[]
  contradictions: Array<{ source: string; sourceUrl?: string; detail: string }>
}

export type SlateEvidenceSnippet = {
  requirementText: string
  state: SlateEvidenceState
  source: string
  sourceUrl?: string
  detail: string
  contradiction?: boolean
}

function priority(requirement: SlateRequirementEvidence): number {
  if (requirement.tier === 'must_have' && requirement.state === 'supported') return 0
  if (requirement.state === 'supported') return 1
  if (requirement.tier === 'must_have' && requirement.state === 'needs_verification') return 2
  if (requirement.state === 'needs_verification') return 3
  if (requirement.state === 'contradicted') return 4
  return 5
}

export function pickSlateEvidenceSnippet(requirements: SlateRequirementEvidence[]): SlateEvidenceSnippet | null {
  const ordered = [...requirements].sort((a, b) => priority(a) - priority(b))

  for (const requirement of ordered) {
    if (!requirement.evidence.length) continue
    const evidence = requirement.evidence.find(item => item.sourceUrl) || requirement.evidence[0]
    return {
      requirementText: requirement.requirementText,
      state: requirement.state,
      source: evidence.source,
      sourceUrl: evidence.sourceUrl,
      detail: evidence.spanText || evidence.detail,
    }
  }

  for (const requirement of ordered) {
    if (!requirement.contradictions.length) continue
    const contradiction = requirement.contradictions.find(item => item.sourceUrl) || requirement.contradictions[0]
    return {
      requirementText: requirement.requirementText,
      state: 'contradicted',
      source: contradiction.source,
      sourceUrl: contradiction.sourceUrl,
      detail: contradiction.detail,
      contradiction: true,
    }
  }

  return null
}
