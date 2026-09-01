import type { AgenticSearchSurface } from './agentic-search-v30'
import type { RoleIntake } from './role-workspace'

export type JobFamilyId =
  | 'software'
  | 'infrastructure'
  | 'cloud_devops'
  | 'cybersecurity'
  | 'data'
  | 'ai_ml'
  | 'healthcare_clinical'
  | 'research_science'
  | 'federal_govcon'
  | 'finance_regulated'
  | 'aviation'
  | 'general'

export type JobFamilyMatchV34 = {
  id: JobFamilyId
  score: number
  reasons: string[]
}

export type JobFamilyRoutingV34 = {
  primaryFamily: JobFamilyId
  matches: JobFamilyMatchV34[]
  preferredPublicSurfaces: AgenticSearchSurface[]
  deprioritizedPublicSurfaces: AgenticSearchSurface[]
  rationale: string[]
}

type FamilyDefinition = {
  id: JobFamilyId
  strong: RegExp[]
  signals: RegExp[]
  preferred: AgenticSearchSurface[]
  deprioritized?: AgenticSearchSurface[]
}

const PUBLIC_EVIDENCE_SURFACES: AgenticSearchSurface[] = [
  'github',
  'stackoverflow',
  'devto',
  'huggingface',
  'research_publications',
  'healthcare_registry',
]

function explicitTextFor(intake: RoleIntake): string {
  return [
    intake.title,
    intake.clearance,
    ...intake.mustHaves,
    ...intake.niceToHaves,
    intake.rawDescription,
  ].filter(Boolean).join(' ').toLowerCase()
}

function expansionTextFor(intake: RoleIntake): string {
  return [
    ...intake.adjacentBackgrounds,
    ...intake.targetCompanies,
    intake.hiringManagerNotes,
  ].filter(Boolean).join(' ').toLowerCase()
}

const DEFINITIONS: FamilyDefinition[] = [
  {
    id: 'infrastructure',
    strong: [
      /\b(?:rhel|red hat enterprise linux|red hat administrator|linux administrator|unix administrator|system administrator|systems administrator|sysadmin)\b/,
      /\b(?:windows server administrator|vmware administrator|network administrator)\b/,
    ],
    signals: [
      /\brhel\b/, /\bred hat\b/, /\blinux\b/, /\bunix\b/, /\bselinux\b/, /\bsystemd\b/, /\bvmware\b/, /\bactive directory\b/,
      /\bsystems? administration\b/, /\bserver administration\b/, /\bansible\b/, /\bpatching\b/, /\byum\b/, /\bdnf\b/, /\brpm\b/,
    ],
    preferred: ['stackoverflow', 'github'],
    deprioritized: ['devto', 'huggingface', 'research_publications'],
  },
  {
    id: 'cloud_devops',
    strong: [
      /\b(?:devops engineer|devsecops engineer|site reliability engineer|sre|cloud engineer|platform engineer|cloud architect)\b/,
    ],
    signals: [
      /\bkubernetes\b/, /\bterraform\b/, /\bhelm\b/, /\bdocker\b/, /\baws\b/, /\bazure\b/, /\bgcp\b/, /\bci\/?cd\b/, /\bjenkins\b/,
      /\binfrastructure as code\b/, /\bobservability\b/, /\bprometheus\b/, /\bgrafana\b/,
    ],
    preferred: ['github', 'stackoverflow', 'devto'],
    deprioritized: ['huggingface', 'research_publications'],
  },
  {
    id: 'cybersecurity',
    strong: [
      /\b(?:security engineer|cybersecurity engineer|cyber security engineer|soc analyst|security analyst|penetration tester|incident responder|threat hunter|security architect)\b/,
    ],
    signals: [
      /\bcyber(?:security)?\b/, /\bsiem\b/, /\bsplunk\b/, /\bsentinel\b/, /\bedr\b/, /\biam\b/, /\bzero trust\b/, /\bincident response\b/,
      /\bthreat hunting\b/, /\bpenetration testing\b/, /\bvulnerability management\b/, /\bnessus\b/,
    ],
    preferred: ['github', 'stackoverflow'],
    deprioritized: ['devto', 'huggingface', 'research_publications'],
  },
  {
    id: 'ai_ml',
    strong: [
      /\b(?:machine learning engineer|ml engineer|ai engineer|nlp engineer|computer vision engineer|llm engineer|mlops engineer)\b/,
    ],
    signals: [
      /\bmachine learning\b/, /\bartificial intelligence\b/, /\bgenerative ai\b/, /\bgenai\b/, /\bllm\b/, /\bnlp\b/, /\bcomputer vision\b/,
      /\bpytorch\b/, /\btensorflow\b/, /\bjax\b/, /\btransformers?\b/, /\brag\b/, /\bembeddings?\b/, /\bfine[- ]?tun/,
    ],
    preferred: ['huggingface', 'github', 'research_publications', 'stackoverflow'],
    deprioritized: ['devto'],
  },
  {
    id: 'data',
    strong: [
      /\b(?:data engineer|analytics engineer|database administrator|dba|data architect|data scientist|bi engineer)\b/,
    ],
    signals: [
      /\bsql\b/, /\bsnowflake\b/, /\bdatabricks\b/, /\bspark\b/, /\bairflow\b/, /\bdbt\b/, /\bpostgres(?:ql)?\b/, /\boracle\b/,
      /\bdata warehouse\b/, /\betl\b/, /\belt\b/, /\bbigquery\b/,
    ],
    preferred: ['github', 'stackoverflow', 'devto'],
    deprioritized: ['huggingface', 'research_publications'],
  },
  {
    id: 'software',
    strong: [
      /\b(?:software engineer|software developer|frontend engineer|front end engineer|backend engineer|back end engineer|full stack engineer|fullstack engineer|mobile engineer)\b/,
    ],
    signals: [
      /\bjavascript\b/, /\btypescript\b/, /\breact\b/, /\bnode\b/, /\bjava\b/, /\bc\+\+\b/, /\bc#\b/, /\bgolang\b/, /\brust\b/, /\bswift\b/, /\bkotlin\b/,
    ],
    preferred: ['github', 'stackoverflow', 'devto'],
    deprioritized: ['huggingface', 'research_publications'],
  },
  {
    id: 'healthcare_clinical',
    strong: [
      /\b(?:physician|doctor|registered nurse|nurse practitioner|physician assistant|pharmacist|therapist|clinician|clinical informatics)\b/,
    ],
    signals: [
      /\bhealthcare\b/, /\bclinical\b/, /\bhospital\b/, /\bmedical\b/, /\bepic\b/, /\bemr\b/, /\behr\b/,
    ],
    preferred: ['healthcare_registry', 'research_publications'],
    deprioritized: ['github', 'stackoverflow', 'devto', 'huggingface'],
  },
  {
    id: 'research_science',
    strong: [
      /\b(?:research scientist|applied scientist|researcher|postdoc|principal investigator|scientist|biostatistician)\b/,
    ],
    signals: [
      /\bresearch\b/, /\bpublication\b/, /\bacademic\b/, /\buniversity\b/, /\blaboratory\b/, /\br&d\b/, /\bscientific\b/,
    ],
    preferred: ['research_publications'],
    deprioritized: ['devto'],
  },
  {
    id: 'federal_govcon',
    strong: [
      /\b(?:ts\/?sci|top secret|secret clearance|public trust|polygraph)\b/,
      /\b(?:federal contractor|government contractor|govcon)\b/,
    ],
    signals: [
      /\bfederal\b/, /\bgovernment\b/, /\bpublic sector\b/, /\bclearance\b/, /\bcitizenship\b/, /\bdod\b/, /\bintel(?:ligence)? community\b/,
    ],
    preferred: [],
    deprioritized: [],
  },
  {
    id: 'finance_regulated',
    strong: [
      /\b(?:financial advisor|broker|investment adviser|portfolio manager|wealth manager)\b/,
    ],
    signals: [
      /\bfinra\b/, /\bsecurities\b/, /\bseries 7\b/, /\bseries 63\b/, /\bseries 65\b/, /\bbrokerage\b/, /\bwealth management\b/,
    ],
    preferred: [],
    deprioritized: ['github', 'stackoverflow', 'devto', 'huggingface', 'research_publications'],
  },
  {
    id: 'aviation',
    strong: [
      /\b(?:pilot|aircraft mechanic|a&p mechanic|flight instructor|avionics technician)\b/,
    ],
    signals: [
      /\baviation\b/, /\baircraft\b/, /\bairline\b/, /\bairman\b/, /\bflight\b/, /\baerospace operations\b/,
    ],
    preferred: [],
    deprioritized: ['github', 'stackoverflow', 'devto', 'huggingface', 'research_publications'],
  },
  {
    id: 'general',
    strong: [],
    signals: [],
    preferred: [],
  },
]

function scoreDefinition(intake: RoleIntake, definition: FamilyDefinition): JobFamilyMatchV34 {
  const explicit = explicitTextFor(intake)
  const expansion = expansionTextFor(intake)
  const reasons: string[] = []
  let score = 0

  // Recruiter-authored title/requirements outrank generated adjacent-title expansions.
  for (const pattern of definition.strong) {
    const match = explicit.match(pattern)?.[0]
    if (!match) continue
    score += 0.62
    reasons.push(match)
  }
  for (const pattern of definition.signals) {
    const match = explicit.match(pattern)?.[0]
    if (!match) continue
    score += 0.14
    reasons.push(match)
  }
  // Expansions can support a family hypothesis but cannot independently create a
  // high-confidence routing decision or beat an explicit title.
  for (const pattern of definition.signals) {
    const match = expansion.match(pattern)?.[0]
    if (!match) continue
    score += 0.04
    reasons.push(`adjacent: ${match}`)
  }

  // Clearance is a field-level federal/GovCon signal even when the normalized
  // value is simply "Secret" and therefore lacks the literal word "clearance".
  if (definition.id === 'federal_govcon' && intake.clearance && intake.clearance !== 'Not specified') {
    score += 0.38
    reasons.push('role clearance requirement')
  }

  return {
    id: definition.id,
    score: Math.min(1, Number(score.toFixed(2))),
    reasons: Array.from(new Set(reasons)).slice(0, 6),
  }
}

function uniq<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

/**
 * Explainable role-family routing for retrieval. This does not establish candidate
 * facts and does not alter recruiter-approved role criteria. It only decides
 * which public evidence communities are likely to have signal for this role.
 */
export function buildJobFamilyRoutingV34(intake: RoleIntake, threshold = 0.28): JobFamilyRoutingV34 {
  const scored = DEFINITIONS
    .filter(definition => definition.id !== 'general')
    .map(definition => scoreDefinition(intake, definition))
    .filter(match => match.score >= threshold)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))

  const matches = scored.length
    ? scored
    : [{ id: 'general' as const, score: 0.25, reasons: ['no specialized family reached routing threshold'] }]
  const primaryFamily = matches[0].id
  const activeDefinitions = DEFINITIONS.filter(definition => matches.some(match => match.id === definition.id))
  const preferredPublicSurfaces = uniq(activeDefinitions.flatMap(definition => definition.preferred))
  const explicitlyDeprioritized = uniq(activeDefinitions.flatMap(definition => definition.deprioritized || []))
  const deprioritizedPublicSurfaces = explicitlyDeprioritized.filter(surface => !preferredPublicSurfaces.includes(surface))

  const rationale = matches.slice(0, 4).map(match => {
    const evidence = match.reasons.length ? ` from ${match.reasons.join(', ')}` : ''
    return `${match.id} ${Math.round(match.score * 100)}%${evidence}`
  })
  if (!preferredPublicSurfaces.length) {
    rationale.push('No public evidence community is automatically preferred; use recruiter-authorized or authoritative domain surfaces where available.')
  }

  return {
    primaryFamily,
    matches,
    preferredPublicSurfaces: preferredPublicSurfaces.filter(surface => PUBLIC_EVIDENCE_SURFACES.includes(surface)),
    deprioritizedPublicSurfaces: deprioritizedPublicSurfaces.filter(surface => PUBLIC_EVIDENCE_SURFACES.includes(surface)),
    rationale,
  }
}
