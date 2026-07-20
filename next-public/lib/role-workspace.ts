export const ROLE_STAGES = [
  'discovered',
  'needs_review',
  'shortlisted',
  'contact_research',
  'ready_for_outreach',
  'outreach_drafted',
  'contacted',
  'responded',
  'interested',
  'submitted',
  'interviewing',
  'offer',
  'closed',
  'archived',
] as const

export type RoleStage = (typeof ROLE_STAGES)[number]
export type FitDecision = 'unreviewed' | 'strong_fit' | 'possible_fit' | 'not_fit'
export type RoleStatus = 'draft' | 'calibrating' | 'active' | 'paused' | 'closed'

export type RoleIntake = {
  title: string
  location: string
  workMode: 'remote' | 'hybrid' | 'onsite' | 'flexible' | 'unknown'
  compensation: string
  clearance: string
  mustHaves: string[]
  niceToHaves: string[]
  disqualifiers: string[]
  targetCompanies: string[]
  adjacentBackgrounds: string[]
  hiringManagerNotes: string
  rawDescription: string
}

export type SearchLane = {
  id: string
  label: string
  purpose: string
  query: string
  source: 'candidate_database' | 'network' | 'github' | 'research' | 'healthcare' | 'resume_xray' | 'web_xray'
  status: 'proposed' | 'approved' | 'paused'
}

export type RoleCandidate = {
  id: string
  candidateId?: string
  name: string
  headline: string
  company: string
  location: string
  source: string
  sourceUrl?: string
  stage: RoleStage
  fitDecision: FitDecision
  fitReasons: string[]
  concerns: string[]
  tags: string[]
  contactStatus: 'unknown' | 'signals_found' | 'verified' | 'blocked'
  evidenceStatus: 'unreviewed' | 'reviewed' | 'conflicting' | 'stale'
  addedAt: string
  updatedAt: string
}

export type RoleActivity = {
  id: string
  type: 'role_created' | 'intake_updated' | 'lane_approved' | 'candidate_added' | 'candidate_reviewed' | 'stage_changed' | 'note_added'
  message: string
  createdAt: string
}

export type RoleWorkspace = {
  id: string
  status: RoleStatus
  intake: RoleIntake
  searchLanes: SearchLane[]
  candidates: RoleCandidate[]
  activity: RoleActivity[]
  createdAt: string
  updatedAt: string
}

const technicalTerms = [
  'AWS', 'Azure', 'GCP', 'Kubernetes', 'Docker', 'Terraform', 'Linux', 'Python', 'Java', 'JavaScript',
  'TypeScript', 'React', 'Next.js', 'Node.js', 'C#', '.NET', 'PostgreSQL', 'DevSecOps', 'Cybersecurity',
  'Machine Learning', 'Artificial Intelligence', 'Data Engineering', 'Cloud Security', 'CI/CD',
]

const softRequirements = ['leadership', 'stakeholder management', 'program management', 'operations', 'strategy', 'communication', 'capture', 'proposal']

function unique(values: string[], max = 20): string[] {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean))).slice(0, max)
}

function matchList(text: string, values: string[]): string[] {
  const lower = text.toLowerCase()
  return values.filter(value => lower.includes(value.toLowerCase()))
}

function extractLabeledLine(text: string, labels: string[]): string {
  for (const label of labels) {
    const match = text.match(new RegExp(`(?:^|\n)\s*${label}\s*[:\-]\s*([^\n]+)`, 'i'))
    if (match?.[1]) return match[1].trim()
  }
  return ''
}

export function parseRoleIntake(rawDescription: string): RoleIntake {
  const lines = rawDescription.split('\n').map(line => line.trim()).filter(Boolean)
  const title = extractLabeledLine(rawDescription, ['title', 'role', 'position']) ||
    lines.find(line => /director|manager|engineer|developer|architect|analyst|recruiter|sourcer|specialist|consultant|lead/i.test(line)) ||
    'Untitled role'
  const location = extractLabeledLine(rawDescription, ['location', 'work location']) || 'Not specified'
  const compensation = extractLabeledLine(rawDescription, ['compensation', 'salary', 'pay range']) || 'Not specified'
  const clearanceMatches = rawDescription.match(/\b(?:TS\/?SCI|Top Secret|Secret|Public Trust|CI Poly|Full Scope Poly)\b/gi) || []
  const lower = rawDescription.toLowerCase()
  const workMode: RoleIntake['workMode'] = lower.includes('remote') ? 'remote' : lower.includes('hybrid') ? 'hybrid' : lower.includes('onsite') || lower.includes('on-site') ? 'onsite' : 'unknown'
  const skills = matchList(rawDescription, technicalTerms)
  const capabilitySignals = matchList(rawDescription, softRequirements).map(value => value.replace(/\b\w/g, char => char.toUpperCase()))

  return {
    title: title.replace(/^\s*(title|role|position)\s*[:\-]\s*/i, '').slice(0, 120),
    location: location.slice(0, 120),
    workMode,
    compensation: compensation.slice(0, 120),
    clearance: unique(clearanceMatches).join(', ') || 'Not specified',
    mustHaves: unique([...skills, ...capabilitySignals], 15),
    niceToHaves: [],
    disqualifiers: [],
    targetCompanies: [],
    adjacentBackgrounds: [],
    hiringManagerNotes: '',
    rawDescription,
  }
}

export function buildSearchLanes(intake: RoleIntake): SearchLane[] {
  const core = [intake.title, ...intake.mustHaves.slice(0, 5), intake.clearance !== 'Not specified' ? intake.clearance : ''].filter(Boolean).join(' ')
  const adjacent = [intake.title, ...intake.adjacentBackgrounds, ...intake.niceToHaves.slice(0, 4)].filter(Boolean).join(' ')
  const lanes: SearchLane[] = [
    { id: 'database', label: 'Existing Candidate Database', purpose: 'Reuse known candidates and prior evidence before spending on external discovery.', query: core, source: 'candidate_database', status: 'approved' },
    { id: 'network', label: 'Relationship Network', purpose: 'Find warm paths and known connections relevant to the role.', query: core, source: 'network', status: 'approved' },
    { id: 'github', label: 'Technical Public Work', purpose: 'Find public technical artifacts and contributor profiles. Evidence is reviewed before identity linking.', query: core, source: 'github', status: 'proposed' },
    { id: 'resume-xray', label: 'Public Resume X-Ray', purpose: 'Generate manual-safe open-web resume discovery queries with no auto-import.', query: core, source: 'resume_xray', status: 'proposed' },
    { id: 'web-xray', label: 'Conference and Portfolio X-Ray', purpose: 'Find speakers, portfolio pages, bios, and public leadership artifacts.', query: core, source: 'web_xray', status: 'proposed' },
  ]

  if (/research|scientist|ai|machine learning|clinical|medical|health|nurse|physician/i.test(`${intake.title} ${core}`)) {
    lanes.push({ id: 'research', label: 'Research and Publication Graph', purpose: 'Search public research identities, publications, institutions, and topic evidence.', query: core, source: 'research', status: 'proposed' })
  }
  if (/nurse|physician|clinical|medical|healthcare|provider/i.test(`${intake.title} ${core}`)) {
    lanes.push({ id: 'healthcare', label: 'Healthcare Registry', purpose: 'Search authoritative public provider and credential breadcrumbs.', query: core, source: 'healthcare', status: 'proposed' })
  }
  if (adjacent.trim() && adjacent !== intake.title) {
    lanes.push({ id: 'adjacent', label: 'Adjacent Backgrounds', purpose: 'Explore approved transferable backgrounds without weakening must-have requirements.', query: adjacent, source: 'web_xray', status: 'proposed' })
  }
  return lanes
}

export function createRoleWorkspace(rawDescription: string, id = crypto.randomUUID(), now = new Date()): RoleWorkspace {
  const intake = parseRoleIntake(rawDescription)
  const createdAt = now.toISOString()
  return {
    id,
    status: 'calibrating',
    intake,
    searchLanes: buildSearchLanes(intake),
    candidates: [],
    activity: [{ id: crypto.randomUUID(), type: 'role_created', message: `Created role workspace for ${intake.title}.`, createdAt }],
    createdAt,
    updatedAt: createdAt,
  }
}

export function roleMetrics(role: RoleWorkspace) {
  const byStage = Object.fromEntries(ROLE_STAGES.map(stage => [stage, role.candidates.filter(candidate => candidate.stage === stage).length])) as Record<RoleStage, number>
  return {
    candidateCount: role.candidates.length,
    strongFits: role.candidates.filter(candidate => candidate.fitDecision === 'strong_fit').length,
    needsReview: role.candidates.filter(candidate => candidate.stage === 'needs_review' || candidate.fitDecision === 'unreviewed').length,
    contactReady: role.candidates.filter(candidate => candidate.stage === 'ready_for_outreach').length,
    conflicts: role.candidates.filter(candidate => candidate.evidenceStatus === 'conflicting').length,
    byStage,
  }
}

export function calibrationInsights(role: RoleWorkspace): string[] {
  const reviewed = role.candidates.filter(candidate => candidate.fitDecision !== 'unreviewed')
  if (reviewed.length < 3) return ['Review at least three candidates before SourcingOS proposes calibration changes.']
  const strong = reviewed.filter(candidate => candidate.fitDecision === 'strong_fit')
  const rejected = reviewed.filter(candidate => candidate.fitDecision === 'not_fit')
  const commonStrongTags = unique(strong.flatMap(candidate => candidate.tags)).filter(tag => strong.filter(candidate => candidate.tags.includes(tag)).length >= 2)
  const commonConcerns = unique(rejected.flatMap(candidate => candidate.concerns)).filter(concern => rejected.filter(candidate => candidate.concerns.includes(concern)).length >= 2)
  return [
    ...(commonStrongTags.length ? [`Strong-fit pattern: ${commonStrongTags.join(', ')}. Consider emphasizing these in approved search lanes.`] : []),
    ...(commonConcerns.length ? [`Repeated rejection pattern: ${commonConcerns.join(', ')}. Consider adding an explicit exclusion or review rule.`] : []),
    `Calibration sample: ${reviewed.length} reviewed, ${strong.length} strong fit, ${rejected.length} not fit.`,
  ]
}

export function stageLabel(stage: RoleStage): string {
  return stage.split('_').map(word => word[0].toUpperCase() + word.slice(1)).join(' ')
}
