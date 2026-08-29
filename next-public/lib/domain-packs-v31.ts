import type { AgenticSearchSurface } from './agentic-search-v30'
import type { RoleIntake } from './role-workspace'

export type DomainPackId = 'general' | 'technical' | 'healthcare' | 'research' | 'federal' | 'finance' | 'aviation'

export type DomainPack = {
  id: DomainPackId
  label: string
  description: string
  executablePublicSurfaces: AgenticSearchSurface[]
  evidenceHints: string[]
  heuristics: string[]
  guardrails: string[]
  detect: (intake: RoleIntake) => { confidence: number; reasons: string[] }
}

export type DomainPackMatch = {
  id: DomainPackId
  label: string
  confidence: number
  reasons: string[]
  executablePublicSurfaces: AgenticSearchSurface[]
  evidenceHints: string[]
  heuristics: string[]
  guardrails: string[]
}

export type DomainPackProfile = {
  matches: DomainPackMatch[]
  activeIds: Set<DomainPackId>
  executablePublicSurfaces: Set<AgenticSearchSurface>
  evidenceHints: string[]
  heuristics: string[]
  guardrails: string[]
}

function roleText(intake: RoleIntake): string {
  return [
    intake.title,
    intake.location,
    intake.clearance,
    ...intake.mustHaves,
    ...intake.niceToHaves,
    ...intake.adjacentBackgrounds,
    ...intake.targetCompanies,
    intake.hiringManagerNotes,
  ].join(' ').toLowerCase()
}

function confidenceFromSignals(text: string, signals: RegExp[], strongSignals: RegExp[] = []): { confidence: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 0
  for (const signal of strongSignals) {
    const match = text.match(signal)?.[0]
    if (!match) continue
    score += 0.34
    reasons.push(match)
  }
  for (const signal of signals) {
    const match = text.match(signal)?.[0]
    if (!match) continue
    score += 0.18
    reasons.push(match)
  }
  return { confidence: Math.min(1, Number(score.toFixed(2))), reasons: Array.from(new Set(reasons)).slice(0, 5) }
}

const PACKS: DomainPack[] = [
  {
    id: 'technical',
    label: 'Technical',
    description: 'Software, cloud, data, infrastructure, security, AI, and engineering roles.',
    executablePublicSurfaces: ['github'],
    evidenceHints: ['public code or repositories', 'technical artifacts', 'technology usage evidence'],
    heuristics: ['Prefer capability combinations over title-only matching.', 'Treat public code as evidence of work, not proof of employment or overall fit.'],
    guardrails: ['Do not infer seniority, employment status, or identity solely from a repository.'],
    detect: intake => confidenceFromSignals(roleText(intake), [
      /\bsoftware\b/, /\bcloud\b/, /\bplatform\b/, /\bdevops\b/, /\bsre\b/, /\bdata engineer/, /\bsecurity\b/, /\bcyber/, /\bkubernetes\b/, /\bterraform\b/, /\bpython\b/, /\bjava\b/, /\btypescript\b/, /\bmachine learning\b/, /\bartificial intelligence\b/
    ], [/\b(engineer|developer|architect)\b/]),
  },
  {
    id: 'healthcare',
    label: 'Healthcare',
    description: 'Clinical, provider, health-system, life-sciences, and healthcare-technology roles.',
    executablePublicSurfaces: ['research_publications'],
    evidenceHints: ['authoritative professional registry records', 'public clinical or research publications', 'specialty and credential breadcrumbs'],
    heuristics: ['Use authoritative registries for discovery or verification where available.', 'Keep license or registry facts separate from job-fit judgments.'],
    guardrails: ['Do not use practice or home-address data as a screening feature.', 'A registry record does not establish current interest, availability, or role fit.'],
    detect: intake => confidenceFromSignals(roleText(intake), [
      /\bhealthcare\b/, /\bclinical\b/, /\bhospital\b/, /\bmedical\b/, /\bhealth system\b/, /\bepic\b/, /\bpharma/, /\bbiotech/
    ], [/\bclinical informatics\b/, /\b(nurse|physician|doctor|clinician|provider|pharmacist|therapist)\b/]),
  },
  {
    id: 'research',
    label: 'Research',
    description: 'Scientific, academic, publication-heavy, and R&D roles.',
    executablePublicSurfaces: ['research_publications'],
    evidenceHints: ['ORCID identity', 'publication authorship', 'institutional research affiliation', 'topic and citation evidence'],
    heuristics: ['Prefer persistent identifiers when linking research identities.', 'Treat publication recency and topic relevance separately from current employment.'],
    guardrails: ['Authorship is evidence of a publication relationship, not proof of current employer or candidate fit.'],
    detect: intake => confidenceFromSignals(roleText(intake), [
      /\bresearch\b/, /\bpublication/, /\bacademic\b/, /\buniversity\b/, /\blaboratory\b/, /\br&d\b/, /\bscientific\b/
    ], [/\b(scientist|researcher|postdoc|principal investigator)\b/]),
  },
  {
    id: 'federal',
    label: 'Federal / GovCon',
    description: 'Federal, public-sector contracting, cleared, and government-adjacent roles.',
    // Intentionally empty. Federal market intelligence can change target organizations,
    // but this pack does not pretend a federal contract API is a people-search source.
    executablePublicSurfaces: [],
    evidenceHints: ['public contract and award context at the organization level', 'candidate-stated clearance breadcrumbs', 'public program or agency context'],
    heuristics: ['Use contract intelligence to identify organizations worth searching, not to manufacture candidates.', 'Keep capability requirements separate from clearance breadcrumbs.'],
    guardrails: ['Public or candidate-stated clearance language is not verification.', 'Contract awards and losses are organization signals, never candidate facts.'],
    detect: intake => {
      const text = roleText(intake)
      const base = confidenceFromSignals(text, [
        /\bfederal\b/, /\bgovcon\b/, /\bgovernment contractor/, /\bpublic sector\b/, /\bagency\b/, /\bcontract award\b/, /\brecompete\b/
      ], [/\b(ts\/?sci|top secret|secret clearance|public trust|polygraph)\b/])
      if (intake.clearance && intake.clearance !== 'Not specified') {
        return { confidence: Math.min(1, Number((base.confidence + 0.35).toFixed(2))), reasons: Array.from(new Set([...base.reasons, 'role clearance requirement'])).slice(0, 5) }
      }
      return base
    },
  },
  {
    id: 'finance',
    label: 'Financial Services',
    description: 'Brokerage, investment, banking, insurance, and regulated-finance roles.',
    executablePublicSurfaces: [],
    evidenceHints: ['authoritative registration records where applicable', 'employment-history breadcrumbs from regulated registries'],
    heuristics: ['Prefer authoritative registration sources when the occupation is regulated.'],
    guardrails: ['Registration status is evidence of a public professional record, not a hiring recommendation.'],
    detect: intake => confidenceFromSignals(roleText(intake), [
      /\bfinance\b/, /\bfinancial\b/, /\bbanking\b/, /\binvestment\b/, /\bwealth management\b/, /\bbroker/, /\bsecurities\b/, /\bfinra\b/
    ]),
  },
  {
    id: 'aviation',
    label: 'Aviation',
    description: 'Pilot, aircraft maintenance, aerospace operations, and certificate-dependent aviation roles.',
    executablePublicSurfaces: [],
    evidenceHints: ['authoritative airman or certificate records where applicable', 'aircraft or maintenance qualification breadcrumbs'],
    heuristics: ['Use authoritative certificate data for discovery or verification where legally and operationally appropriate.'],
    guardrails: ['Do not treat a public certificate record as evidence of availability, interest, or overall job fit.'],
    detect: intake => confidenceFromSignals(roleText(intake), [
      /\baviation\b/, /\baircraft\b/, /\bairline\b/, /\bairman\b/, /\bflight\b/, /\baerospace\b/
    ], [/\b(pilot|aircraft mechanic|a&p mechanic|flight instructor)\b/]),
  },
  {
    id: 'general',
    label: 'General',
    description: 'Cross-industry sourcing defaults used alongside specialized packs.',
    executablePublicSurfaces: [],
    evidenceHints: ['recruiter-provided profile evidence', 'public professional evidence appropriate to the role'],
    heuristics: ['Start with the approved role brief and preserve unknowns rather than filling gaps with inference.'],
    guardrails: ['Human review controls consequential hiring actions.'],
    detect: () => ({ confidence: 0.25, reasons: ['general sourcing baseline'] }),
  },
]

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)))
}

export function detectDomainPacks(intake: RoleIntake, threshold = 0.34): DomainPackMatch[] {
  const matches = PACKS.map(pack => {
    const detected = pack.detect(intake)
    return {
      id: pack.id,
      label: pack.label,
      confidence: detected.confidence,
      reasons: detected.reasons,
      executablePublicSurfaces: [...pack.executablePublicSurfaces],
      evidenceHints: [...pack.evidenceHints],
      heuristics: [...pack.heuristics],
      guardrails: [...pack.guardrails],
    }
  }).filter(match => match.id === 'general' || match.confidence >= threshold)

  return matches.sort((a, b) => {
    if (a.id === 'general') return 1
    if (b.id === 'general') return -1
    return b.confidence - a.confidence || a.id.localeCompare(b.id)
  })
}

export function buildDomainPackProfile(intake: RoleIntake): DomainPackProfile {
  const matches = detectDomainPacks(intake)
  return {
    matches,
    activeIds: new Set(matches.map(match => match.id)),
    executablePublicSurfaces: new Set(matches.flatMap(match => match.executablePublicSurfaces)),
    evidenceHints: uniq(matches.flatMap(match => match.evidenceHints)),
    heuristics: uniq(matches.flatMap(match => match.heuristics)),
    guardrails: uniq(matches.flatMap(match => match.guardrails)),
  }
}

export function domainPackById(id: DomainPackId): DomainPack | undefined {
  return PACKS.find(pack => pack.id === id)
}
