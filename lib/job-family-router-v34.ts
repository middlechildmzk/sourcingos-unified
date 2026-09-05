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
  | 'talent_acquisition'
  | 'product_management'
  | 'program_management'
  | 'gtm_sales'
  | 'operations'
  | 'legal_compliance'
  | 'federal_govcon'
  | 'finance_regulated'
  | 'aviation'
  | 'general'

export type JobFamilyMatchV34 = {
  id: JobFamilyId
  score: number
  reasons: string[]
}

export type JobFamilyKind = 'occupation' | 'context_modifier'

export type JobFamilyRoutingV34 = {
  primaryFamily: JobFamilyId
  matches: JobFamilyMatchV34[]
  contextModifiers: JobFamilyMatchV34[]
  occupationResolved: boolean
  preferredPublicSurfaces: AgenticSearchSurface[]
  deprioritizedPublicSurfaces: AgenticSearchSurface[]
  rationale: string[]
}

type FamilyDefinition = {
  id: JobFamilyId
  kind: JobFamilyKind
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

const PUBLIC_TECHNICAL_SURFACES: AgenticSearchSurface[] = [
  'github',
  'stackoverflow',
  'devto',
  'huggingface',
  'research_publications',
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
    kind: 'occupation',
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
    kind: 'occupation',
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
    kind: 'occupation',
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
    kind: 'occupation',
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
    kind: 'occupation',
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
    kind: 'occupation',
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
    kind: 'occupation',
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
    kind: 'occupation',
    strong: [
      /\b(?:research scientist|applied scientist|researcher|postdoc|principal investigator|biostatistician)\b/,
    ],
    signals: [
      /\bresearch\b/, /\bpublication\b/, /\bacademic\b/, /\buniversity\b/, /\blaboratory\b/, /\br&d\b/, /\bscientific\b/,
    ],
    preferred: ['research_publications'],
    deprioritized: ['devto'],
  },
  {
    id: 'talent_acquisition',
    kind: 'occupation',
    strong: [
      /\b(?:technical sourcer|talent sourcer|sourcing specialist|technical recruiter|corporate recruiter|talent acquisition specialist|talent acquisition partner|recruiting manager|talent partner)\b/,
    ],
    signals: [
      /\bsourcing\b/, /\brecruiting\b/, /\brecruiter\b/, /\btalent acquisition\b/, /\bboolean search\b/, /\bcandidate pipeline\b/,
      /\bats\b/, /\bgreenhouse\b/, /\blever\b/, /\bworkday recruiting\b/, /\bavature\b/,
    ],
    preferred: [],
    deprioritized: PUBLIC_TECHNICAL_SURFACES,
  },
  {
    id: 'product_management',
    kind: 'occupation',
    strong: [/\b(?:product manager|senior product manager|technical product manager|group product manager|product lead|director of product)\b/],
    signals: [/\bproduct strategy\b/, /\bproduct roadmap\b/, /\buser research\b/, /\bproduct discovery\b/, /\bproduct requirements?\b/, /\bprd\b/],
    preferred: [],
    deprioritized: PUBLIC_TECHNICAL_SURFACES,
  },
  {
    id: 'program_management',
    kind: 'occupation',
    strong: [/\b(?:program manager|technical program manager|project manager|program director|pmo manager|project management professional)\b/],
    signals: [/\bprogram management\b/, /\bproject management\b/, /\bpmp\b/, /\bpmo\b/, /\bmilestone\b/, /\bschedule management\b/],
    preferred: [],
    deprioritized: PUBLIC_TECHNICAL_SURFACES,
  },
  {
    id: 'gtm_sales',
    kind: 'occupation',
    strong: [/\b(?:enterprise account executive|account executive|sales executive|sales director|business development manager|sales engineer|solutions engineer|customer success manager)\b/],
    signals: [/\bquota\b/, /\bpipeline generation\b/, /\bterritory\b/, /\benterprise sales\b/, /\bgo[- ]to[- ]market\b/, /\bgtm\b/, /\bpre[- ]sales\b/],
    preferred: [],
    deprioritized: PUBLIC_TECHNICAL_SURFACES,
  },
  {
    id: 'operations',
    kind: 'occupation',
    strong: [/\b(?:operations manager|operations supervisor|warehouse supervisor|warehouse manager|logistics manager|supply chain manager|distribution center manager)\b/],
    signals: [/\boperations\b/, /\bwarehouse\b/, /\blogistics\b/, /\bsupply chain\b/, /\bdistribution center\b/, /\binventory management\b/],
    preferred: [],
    deprioritized: PUBLIC_TECHNICAL_SURFACES,
  },
  {
    id: 'legal_compliance',
    kind: 'occupation',
    strong: [/\b(?:attorney|lawyer|paralegal|legal counsel|general counsel|compliance officer|regulatory counsel)\b/],
    signals: [/\blegal\b/, /\bcontract law\b/, /\bregulatory compliance\b/, /\blitigation\b/, /\bbar admission\b/],
    preferred: [],
    deprioritized: PUBLIC_TECHNICAL_SURFACES,
  },
  {
    id: 'federal_govcon',
    kind: 'context_modifier',
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
    kind: 'occupation',
    strong: [
      /\b(?:financial advisor|broker|investment adviser|portfolio manager|wealth manager)\b/,
    ],
    signals: [
      /\bfinra\b/, /\bsecurities\b/, /\bseries 7\b/, /\bseries 63\b/, /\bseries 65\b/, /\bbrokerage\b/, /\bwealth management\b/,
    ],
    preferred: [],
    deprioritized: PUBLIC_TECHNICAL_SURFACES,
  },
  {
    id: 'aviation',
    kind: 'occupation',
    strong: [
      /\b(?:pilot|aircraft mechanic|aircraft maintenance technician|a&p mechanic|a&p technician|airframe and powerplant|flight instructor|avionics technician)\b/,
      /\b(?:a&p|a and p)\s*(?:certificat\w+|licens\w+|mechanic|technician)\b/,
      /\bairframe and powerplant\b/,
    ],
    signals: [
      /\baviation\b/, /\baircraft\b/, /\bairline\b/, /\bairman\b/, /\bflight\b/, /\baerospace operations\b/,
      /\ba&p\b/, /\bpart 145\b/, /\bmro\b/, /\bavionics\b/, /\bpowerplant\b/, /\bfaa\b/,
    ],
    preferred: [],
    deprioritized: PUBLIC_TECHNICAL_SURFACES,
  },
  {
    id: 'general',
    kind: 'occupation',
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
  for (const pattern of definition.signals) {
    const match = expansion.match(pattern)?.[0]
    if (!match) continue
    score += 0.04
    reasons.push(`adjacent: ${match}`)
  }

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

export function buildJobFamilyRoutingV34(intake: RoleIntake, threshold = 0.28): JobFamilyRoutingV34 {
  const scored = DEFINITIONS
    .filter(definition => definition.id !== 'general')
    .map(definition => scoreDefinition(intake, definition))
    .filter(match => match.score >= threshold)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))

  const matches = scored.length
    ? scored
    : [{ id: 'general' as const, score: 0.25, reasons: ['no specialized family reached routing threshold'] }]

  const kindOf = (id: JobFamilyId): JobFamilyKind =>
    DEFINITIONS.find(definition => definition.id === id)?.kind ?? 'occupation'

  const occupationMatches = matches.filter(match => kindOf(match.id) === 'occupation')
  const contextModifiers = matches.filter(match => kindOf(match.id) === 'context_modifier')
  const occupationResolved = occupationMatches.some(match => match.id !== 'general')
  const primaryFamily: JobFamilyId = occupationMatches[0]?.id ?? 'general'

  const activeDefinitions = DEFINITIONS.filter(definition =>
    definition.kind === 'occupation' && occupationMatches.some(match => match.id === definition.id))
  const preferredPublicSurfaces = uniq(activeDefinitions.flatMap(definition => definition.preferred))
  const explicitlyDeprioritized = uniq(activeDefinitions.flatMap(definition => definition.deprioritized || []))
  const deprioritizedPublicSurfaces = explicitlyDeprioritized.filter(surface => !preferredPublicSurfaces.includes(surface))

  const rationale = matches.slice(0, 4).map(match => {
    const evidence = match.reasons.length ? ` from ${match.reasons.join(', ')}` : ''
    return `${match.id} ${Math.round(match.score * 100)}%${evidence}`
  })
  for (const modifier of contextModifiers) {
    rationale.push(`${modifier.id} is a hiring-context modifier, not the occupation. It shapes constraints and does not select public evidence sources.`)
  }
  if (!occupationResolved) {
    rationale.push('No occupational family reached the routing threshold. Source selection has no occupational intelligence for this role, which is unknown rather than a judgment that these sources are noisy.')
  }
  if (!preferredPublicSurfaces.length) {
    rationale.push('No public evidence community is automatically preferred; use recruiter-authorized or authoritative domain surfaces where available.')
  }

  return {
    primaryFamily,
    matches,
    contextModifiers,
    occupationResolved,
    preferredPublicSurfaces: preferredPublicSurfaces.filter(surface => PUBLIC_EVIDENCE_SURFACES.includes(surface)),
    deprioritizedPublicSurfaces: deprioritizedPublicSurfaces.filter(surface => PUBLIC_EVIDENCE_SURFACES.includes(surface)),
    rationale,
  }
}
