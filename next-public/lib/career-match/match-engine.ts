import type {
  AdjacentRole,
  CareerMatchRoleUniverse,
  CareerPreferences,
  FitScoreBand,
  JobMatchResult,
  MatchGroup,
  MatchGroupId,
  MatchScoreBreakdown,
  MatchableJob,
  RecruitingRoleFamily,
  ResumeProfile,
  SeniorityLevel,
} from './types'
import { getAdjacentFamilies, getRoleFamilyLabel, recruitingRoleTaxonomy, roleFamilyOrder } from './role-taxonomy'

const ROLE_QUERY_EXPANSIONS: Record<RecruitingRoleFamily, string[]> = {
  recruiter: [
    'recruiter', 'talent acquisition specialist', 'corporate recruiter', 'full cycle recruiter',
    'talent partner', 'ta partner', 'recruiting specialist', 'talent acquisition partner',
  ],
  sourcer: [
    'sourcer', 'talent sourcer', 'senior talent sourcer', 'technical sourcer', 'engineering sourcer',
    'candidate sourcer', 'recruiting researcher', 'candidate researcher', 'pipeline specialist',
  ],
  'technical-sourcer': [
    'technical sourcer', 'senior technical sourcer', 'engineering sourcer', 'technical recruiter',
    'senior technical recruiter', 'engineering recruiter', 'software recruiter', 'ai recruiter',
  ],
  'remote-recruiter': [
    'remote recruiter', 'remote sourcer', 'remote technical recruiter', 'distributed recruiter',
    'global recruiter', 'contract recruiter',
  ],
  'recruiting-ops': [
    'recruiting operations', 'recruiting ops', 'talent operations', 'ta operations',
    'recruiting enablement', 'recruiting program manager', 'ats administrator', 'recruiting systems',
  ],
  'healthcare-recruiter': [
    'healthcare recruiter', 'clinical recruiter', 'nurse recruiter', 'provider recruiter',
    'allied health recruiter', 'medical recruiter',
  ],
  'govcon-recruiter': [
    'federal recruiter', 'cleared recruiter', 'govcon recruiter', 'defense recruiter',
    'security clearance recruiter', 'cleared sourcer',
  ],
  'ai-recruiter': [
    'ai recruiter', 'machine learning recruiter', 'ml recruiter', 'ai sourcer',
    'research recruiter', 'data science recruiter',
  ],
  'talent-intelligence': [
    'talent intelligence', 'talent intelligence analyst', 'talent researcher', 'market intelligence',
    'talent insights', 'workforce intelligence', 'sourcing intelligence',
  ],
  'rpo-recruiter': [
    'rpo recruiter', 'embedded recruiter', 'contract recruiter', 'staffing recruiter',
    'agency recruiter', 'recruitment consultant', 'onsite recruiter',
  ],
}

const STRONG_RECRUITING_TITLE_TERMS = [
  'technical sourcer', 'technical recruiter', 'engineering sourcer', 'engineering recruiter', 'talent sourcer',
  'sourcer', 'sourcing partner', 'talent sourcing', 'recruiter', 'talent acquisition', 'ta partner',
  'talent partner', 'recruiting manager', 'technical recruiting manager', 'talent intelligence',
  'recruiting operations', 'recruiting ops', 'ai recruiter', 'machine learning recruiter', 'research recruiter',
]

const TECHNICAL_TITLE_TERMS = [
  'technical sourcer', 'technical recruiter', 'engineering sourcer', 'engineering recruiter', 'software recruiter',
  'tech recruiter', 'ai recruiter', 'machine learning recruiter', 'research recruiter', 'sourcer, tech',
]

const WEAK_OR_ADJACENT_TITLE_TERMS = [
  'design recruiter', 'product recruiter', 'business recruiter', 'gtm recruiter', 'go to market recruiter',
  'people operations', 'people ops', 'early talent', 'university recruiter', 'campus recruiter',
  'associate recruiter', 'recruiting coordinator', 'talent coordinator', 'executive recruiter',
]

const INTERNATIONAL_LOCATION_TERMS = [
  'united kingdom', 'serbia', 'belgrade', 'singapore', 'tokyo', 'japan', 'dublin', 'ireland', 'colombia',
  'canada', 'vancouver', 'london', 'emea', 'apac', 'europe', 'india', 'mexico', 'brazil', 'australia',
]

const CLEARANCE_REQUIREMENT_PATTERN = /\b(ts\/?sci|ts sci|top secret|secret clearance|security clearance|clearance required|clearance eligible|active clearance|active dod|dod clearance|polygraph|poly|ci poly|full scope|fsp|cleared|govcon|defense|department of defense|\bdod\b|federal)\b/i

function textForJob(job: MatchableJob): string {
  return [job.title, job.company, job.location, job.remoteType, job.employmentType, job.salaryRange, job.description, job.category, ...(job.tags || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function titleText(job: MatchableJob): string {
  return String(job.title || '').toLowerCase()
}

function unique<T extends string>(items: T[]): T[] {
  return Array.from(new Set(items.map(item => item.trim()).filter(Boolean))) as T[]
}

function scoreTerms(text: string, terms: string[], weight: number): number {
  return terms.reduce((score, term) => score + (text.includes(term.toLowerCase()) ? weight : 0), 0)
}

function normalizeTitle(title: string): string {
  return String(title || '')
    .toLowerCase()
    .replace(/\b\(?(?:fixed term|contract|maternity cover|short term|temporary|temp|remote|amer|americas|us|usa|canada|emea|apac)\)?\b/g, ' ')
    .replace(/[\[\]()/:,|–—-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizedCompanyTitleKey(job: MatchableJob): string {
  return `${String(job.company || '').toLowerCase().trim()}::${normalizeTitle(job.title)}`
}

function isRemoteJob(job: MatchableJob): boolean {
  return /\bremote\b/i.test(`${job.remoteType || ''} ${job.location || ''} ${job.description || ''}`)
}

function isOnsiteVague(job: MatchableJob): boolean {
  const text = `${job.remoteType || ''} ${job.location || ''}`.toLowerCase()
  return text.includes('onsite/varies') || text.includes('onsite') || text.includes('on-site') || text.includes('in-office')
}

function isInternationalForUsRemote(job: MatchableJob): boolean {
  const text = `${job.location || ''} ${job.remoteType || ''}`.toLowerCase()
  if (text.includes('united states') || text.includes(' us') || text.includes('usa') || text.includes('remote - us')) return false
  return INTERNATIONAL_LOCATION_TERMS.some(term => text.includes(term))
}

function titleHasAny(job: MatchableJob, terms: string[]): boolean {
  const title = titleText(job)
  return terms.some(term => title.includes(term))
}

function hasStrongRecruitingTitle(job: MatchableJob): boolean {
  return titleHasAny(job, STRONG_RECRUITING_TITLE_TERMS)
}

function hasTechnicalTitle(job: MatchableJob): boolean {
  return titleHasAny(job, TECHNICAL_TITLE_TERMS)
}

function hasWeakOrAdjacentTitle(job: MatchableJob): boolean {
  return titleHasAny(job, WEAK_OR_ADJACENT_TITLE_TERMS)
}

function hasClearanceRequirement(job: MatchableJob): boolean {
  return CLEARANCE_REQUIREMENT_PATTERN.test(textForJob(job))
}

function profileHasFederalOrClearanceBreadcrumb(profile: ResumeProfile): boolean {
  return profile.clearance.status === 'unverified-breadcrumb' || profile.industries.includes('federal')
}

function hasTitleAlignment(profile: ResumeProfile, job: MatchableJob, jobFamily: RecruitingRoleFamily): boolean {
  if (profile.primaryFamily === 'technical-sourcer' || profile.roleFamilies.includes('technical-sourcer')) {
    return hasTechnicalTitle(job) || titleHasAny(job, ['sourcer', 'sourcing'])
  }
  const familyTerms = profile.roleFamilies.flatMap(family => recruitingRoleTaxonomy[family].titleSignals)
  return titleHasAny(job, unique([...familyTerms, ...recruitingRoleTaxonomy[jobFamily].titleSignals]))
}

function isWeakForProfile(profile: ResumeProfile, job: MatchableJob, jobFamily: RecruitingRoleFamily): boolean {
  if (!hasWeakOrAdjacentTitle(job)) return false
  if (profile.primaryFamily === 'recruiting-ops' && jobFamily === 'recruiting-ops') return false
  if (profile.primaryFamily === 'recruiter' && /full.?cycle|corporate recruiter|talent acquisition partner/i.test(job.title)) return false
  return true
}

function preferenceQuality(profile: ResumeProfile, preferences: CareerPreferences, job: MatchableJob, jobFamily: RecruitingRoleFamily) {
  const remotePreferred = preferences.workMode === 'remote'
  const remote = isRemoteJob(job)
  const onsiteOrVague = isOnsiteVague(job)
  const internationalForRemote = remotePreferred && !remote && isInternationalForUsRemote(job)
  const titleAligned = hasTitleAlignment(profile, job, jobFamily)
  const technicalAligned = hasTechnicalTitle(job)
  const weakForProfile = isWeakForProfile(profile, job, jobFamily)
  const strongRecruitingTitle = hasStrongRecruitingTitle(job)
  const clearanceRequired = hasClearanceRequirement(job) || jobFamily === 'govcon-recruiter'
  const entryLevelTitle = /\b(associate|coordinator|junior|entry|intern|early talent|university|campus)\b/i.test(job.title)
  const seniorProfile = ['senior-ic', 'lead', 'manager', 'director-plus'].includes(profile.seniority)
  const seniorityMismatch = seniorProfile && entryLevelTitle
  const managerTitle = /\b(manager|director|head of|vp|vice president)\b/i.test(job.title)
  const tooManagerial = managerTitle && !['manager', 'director-plus'].includes(profile.seniority)
  const bestFitEligible = titleAligned && strongRecruitingTitle && !weakForProfile && !seniorityMismatch && !internationalForRemote && !clearanceRequired && (!remotePreferred || remote)

  const badges = unique([
    remote ? 'Remote' : '',
    remotePreferred && !remote ? 'Remote mismatch' : '',
    titleAligned ? 'Title aligned' : 'Adjacent title',
    technicalAligned ? 'Technical TA' : '',
    clearanceRequired ? 'Clearance review' : '',
    weakForProfile ? 'Adjacent lane' : '',
    seniorityMismatch ? 'Seniority mismatch' : '',
    job.alternateLocations && job.alternateLocations.length > 1 ? `${job.alternateLocations.length} locations` : '',
  ])

  return {
    remote,
    onsiteOrVague,
    internationalForRemote,
    titleAligned,
    technicalAligned,
    weakForProfile,
    strongRecruitingTitle,
    clearanceRequired,
    seniorityMismatch,
    tooManagerial,
    bestFitEligible,
    badges,
  }
}

export function inferJobRoleFamily(job: MatchableJob): RecruitingRoleFamily {
  const text = textForJob(job)
  const title = titleText(job)
  const category = (job.category || '').toLowerCase()

  if (hasClearanceRequirement(job)) return 'govcon-recruiter'
  if (/people operations|people ops|recruiting operations|recruiting ops|talent operations|ats administrator|recruiting systems/.test(title)) return 'recruiting-ops'
  if (/talent intelligence|talent insights|market intelligence|workforce intelligence|talent researcher/.test(title)) return 'talent-intelligence'
  if (/sourcer|sourcing/.test(title)) return title.includes('technical') || title.includes('engineering') || title.includes('ai') ? 'technical-sourcer' : 'sourcer'
  if (/technical recruiter|engineering recruiter|software recruiter|ai recruiter|machine learning recruiter|research recruiter/.test(title)) return 'technical-sourcer'
  if (/healthcare|clinical|nurse|provider|physician/.test(title)) return 'healthcare-recruiter'
  if (/rpo|embedded|staffing|agency|contract recruiter/.test(title)) return 'rpo-recruiter'

  const categoryAliases: Record<string, RecruitingRoleFamily> = {
    sourcer: 'sourcer',
    recruiter: 'recruiter',
    'technical-sourcer': 'technical-sourcer',
    'technical-recruiter': 'technical-sourcer',
    'technical-recruiter-jobs': 'technical-sourcer',
    'remote-recruiter': 'remote-recruiter',
    'remote-recruiter-jobs': 'remote-recruiter',
    'recruiting-ops': 'recruiting-ops',
    'recruiting-operations': 'recruiting-ops',
    'recruiting-operations-jobs': 'recruiting-ops',
    'healthcare-recruiter': 'healthcare-recruiter',
    'healthcare-recruiter-jobs': 'healthcare-recruiter',
    'govcon-recruiter': 'govcon-recruiter',
    'federal-recruiter': 'govcon-recruiter',
    'govcon-recruiter-jobs': 'govcon-recruiter',
    'ai-recruiter': 'ai-recruiter',
    'ai-recruiter-jobs': 'ai-recruiter',
  }
  if (category && categoryAliases[category]) return categoryAliases[category]

  const scored = roleFamilyOrder.map(family => {
    const entry = recruitingRoleTaxonomy[family]
    let score = 0
    score += scoreTerms(title, entry.titleSignals, 10)
    score += scoreTerms(text, entry.titleSignals, 4)
    score += scoreTerms(text, entry.skillSignals, 2)
    score += scoreTerms(text, entry.toolSignals, 1)
    score += scoreTerms(text, entry.industrySignals, 1)
    if (category.includes(entry.jobSearchCategory.toLowerCase())) score += 10
    if (category.includes(family)) score += 10
    return { family, score }
  })
  return scored.sort((a, b) => b.score - a.score)[0]?.family || 'recruiter'
}

function seniorityRank(level: SeniorityLevel): number {
  const map: Record<SeniorityLevel, number> = {
    entry: 1,
    mid: 2,
    'senior-ic': 3,
    lead: 4,
    manager: 5,
    'director-plus': 6,
    unknown: 0,
  }
  return map[level]
}

function inferJobSeniority(job: MatchableJob): SeniorityLevel {
  const text = textForJob(job)
  if (/\b(vp|vice president|head of|director)\b/.test(text)) return 'director-plus'
  if (/\b(manager|leadership|people manager|recruiting manager)\b/.test(text)) return 'manager'
  if (/\b(lead|principal|staff)\b/.test(text)) return 'lead'
  if (/\b(senior|sr\.?|ii|iii)\b/.test(text)) return 'senior-ic'
  if (/\b(coordinator|associate|junior|entry|intern|early talent|university|campus)\b/.test(text)) return 'entry'
  return 'mid'
}

function workModeFits(job: MatchableJob, preferences: CareerPreferences): boolean {
  const preferred = preferences.workMode || 'any'
  if (preferred === 'any') return true
  if (preferred === 'remote') return isRemoteJob(job)
  const text = `${job.remoteType || ''} ${job.location || ''} ${job.description || ''}`.toLowerCase()
  if (preferred === 'hybrid') return text.includes('hybrid') || text.includes('remote')
  if (preferred === 'onsite') return !text.includes('remote') || text.includes('onsite') || text.includes('on-site')
  return true
}

function locationFits(job: MatchableJob, preferences: CareerPreferences): boolean {
  const pref = (preferences.location || '').trim().toLowerCase()
  if (!pref) return true
  const jobText = `${job.location || ''} ${job.remoteType || ''}`.toLowerCase()
  if (jobText.includes('remote')) return true
  return jobText.includes(pref) || pref.split(/[,\.\s]+/).some(part => part.length > 2 && jobText.includes(part))
}

function salaryPresent(job: MatchableJob): boolean {
  const salary = (job.salaryRange || '').toLowerCase()
  return Boolean(salary && !salary.includes('not listed') && !salary.includes('not provided'))
}

function bandForScore(score: number, familyAligned: boolean, adjacentAligned: boolean, quality: ReturnType<typeof preferenceQuality>): FitScoreBand {
  if (score >= 72 && familyAligned && quality.bestFitEligible) return 'Strong Fit'
  if (score >= 58 && !quality.weakForProfile && !quality.seniorityMismatch && !quality.internationalForRemote) return 'Good Fit'
  if (score >= 34 || adjacentAligned || quality.titleAligned) return 'Adjacent Fit'
  return 'Stretch'
}

function capClearedBand(profile: ResumeProfile, job: MatchableJob, jobFamily: RecruitingRoleFamily, band: FitScoreBand): FitScoreBand {
  const clearanceRequired = hasClearanceRequirement(job) || jobFamily === 'govcon-recruiter'
  if (!clearanceRequired) return band
  if (profileHasFederalOrClearanceBreadcrumb(profile)) return band === 'Strong Fit' ? 'Good Fit' : band
  return band === 'Strong Fit' || band === 'Good Fit' ? 'Adjacent Fit' : band
}

function buildBreakdown(profile: ResumeProfile, preferences: CareerPreferences, job: MatchableJob, jobFamily: RecruitingRoleFamily): MatchScoreBreakdown {
  const jobText = textForJob(job)
  const jobEntry = recruitingRoleTaxonomy[jobFamily]
  const exactFamily = profile.roleFamilies.includes(jobFamily) || preferences.desiredRoleType === jobFamily
  const adjacentFamily = profile.roleFamilies.some(family => getAdjacentFamilies(family).includes(jobFamily))
  const quality = preferenceQuality(profile, preferences, job, jobFamily)

  const matchedTools = profile.tools.filter(tool => jobText.includes(tool.toLowerCase()))
  const matchedIndustries = profile.industries.filter(industry => jobText.includes(industry.toLowerCase()))
  const matchedSpecialties = profile.specialties.filter(specialty => jobText.includes(specialty.toLowerCase().replace(' / ', ' ')))
  const requiredSignals = unique([...jobEntry.skillSignals, ...jobEntry.toolSignals, ...jobEntry.industrySignals])
  const profileSignalText = `${profile.currentTitle} ${profile.pastTitles.join(' ')} ${profile.tools.join(' ')} ${profile.industries.join(' ')} ${profile.specialties.join(' ')}`.toLowerCase()
  const signalOverlap = requiredSignals.filter(signal => profileSignalText.includes(signal.toLowerCase()))

  const jobSeniority = inferJobSeniority(job)
  const userRank = seniorityRank(profile.seniority)
  const jobRank = seniorityRank(jobSeniority)
  const seniority = quality.seniorityMismatch ? -8 : userRank === 0 ? 2 : userRank >= jobRank ? 8 : Math.max(0, 5 - (jobRank - userRank) * 2)

  const roleFamily = exactFamily && quality.titleAligned ? 36 : exactFamily ? 26 : adjacentFamily ? 16 : signalOverlap.length ? Math.min(10, signalOverlap.length * 2) : 0
  const tools = quality.titleAligned ? Math.min(14, matchedTools.length * 5) : Math.min(6, matchedTools.length * 2)
  const industry = Math.min(7, matchedIndustries.length * 2)
  const specialty = Math.min(16, matchedSpecialties.length * 4 + signalOverlap.length * 2 + (quality.titleAligned ? 4 : 0))
  const preference = (workModeFits(job, preferences) ? 8 : preferences.workMode === 'remote' ? -10 : 0) + (locationFits(job, preferences) ? 4 : -3)
  const salary = salaryPresent(job) ? 3 : 0
  const clearance = quality.clearanceRequired
    ? profileHasFederalOrClearanceBreadcrumb(profile) ? 8 : -14
    : 0

  return { roleFamily, tools, industry, specialty, seniority, preference, salary, clearance }
}

function totalScore(breakdown: MatchScoreBreakdown): number {
  return Math.max(0, Math.min(100, Math.round(Object.values(breakdown).reduce((sum, value) => sum + value, 0))))
}

function qualityAdjustment(profile: ResumeProfile, preferences: CareerPreferences, job: MatchableJob, jobFamily: RecruitingRoleFamily): number {
  const quality = preferenceQuality(profile, preferences, job, jobFamily)
  let adjustment = 0
  if (quality.titleAligned) adjustment += 8
  if (quality.technicalAligned && (profile.primaryFamily === 'technical-sourcer' || profile.roleFamilies.includes('technical-sourcer'))) adjustment += 8
  if (quality.remote && preferences.workMode === 'remote') adjustment += 8
  if (preferences.workMode === 'remote' && !quality.remote) adjustment -= quality.onsiteOrVague ? 12 : 8
  if (quality.internationalForRemote) adjustment -= 10
  if (quality.weakForProfile) adjustment -= 14
  if (quality.seniorityMismatch) adjustment -= 18
  if (quality.tooManagerial) adjustment -= 6
  if (quality.clearanceRequired && !profileHasFederalOrClearanceBreadcrumb(profile)) adjustment -= 6
  if (!quality.strongRecruitingTitle) adjustment -= 12
  return adjustment
}

function topMatchedTools(profile: ResumeProfile, job: MatchableJob): string[] {
  const text = textForJob(job)
  return profile.tools.filter(tool => text.includes(tool.toLowerCase())).slice(0, 5)
}

function topMatchedIndustries(profile: ResumeProfile, job: MatchableJob): string[] {
  const text = textForJob(job)
  return profile.industries.filter(industry => text.includes(industry.toLowerCase())).slice(0, 4)
}

function missingSignals(profile: ResumeProfile, job: MatchableJob, jobFamily: RecruitingRoleFamily): string[] {
  const profileText = `${profile.currentTitle} ${profile.pastTitles.join(' ')} ${profile.tools.join(' ')} ${profile.industries.join(' ')} ${profile.specialties.join(' ')}`.toLowerCase()
  const jobText = textForJob(job)
  const entry = recruitingRoleTaxonomy[jobFamily]
  const needed = unique([...entry.toolSignals, ...entry.skillSignals, ...entry.industrySignals])
  return needed
    .filter(signal => jobText.includes(signal.toLowerCase()) && !profileText.includes(signal.toLowerCase()))
    .slice(0, 6)
}

function buildExplanation(profile: ResumeProfile, preferences: CareerPreferences, job: MatchableJob, jobFamily: RecruitingRoleFamily, score: number, breakdown: MatchScoreBreakdown): JobMatchResult['explanation'] {
  const tools = topMatchedTools(profile, job)
  const industries = topMatchedIndustries(profile, job)
  const gaps = missingSignals(profile, job, jobFamily)
  const quality = preferenceQuality(profile, preferences, job, jobFamily)
  const fitReasons: string[] = []
  const potentialGaps: string[] = []
  const foundInResume: string[] = []
  const suggestedPositioning: string[] = []
  const contributingSignals: string[] = []
  const cautionNotes: string[] = []

  fitReasons.push(`Your parsed profile maps closest to ${getRoleFamilyLabel(profile.primaryFamily)}, and this role maps to ${getRoleFamilyLabel(jobFamily)}.`)
  contributingSignals.push(`Profile family: ${getRoleFamilyLabel(profile.primaryFamily)}`)
  contributingSignals.push(`Job family: ${getRoleFamilyLabel(jobFamily)}`)

  if (quality.titleAligned) fitReasons.push('The job title is aligned with your strongest recruiting lane.')
  if (quality.remote && preferences.workMode === 'remote') fitReasons.push('The role appears remote-compatible, which matches your remote preference.')

  if (profile.yearsExperience !== null) {
    fitReasons.push(`Your resume indicates ${profile.yearsExperienceLabel.toLowerCase()}, which supports the ${profile.seniority} seniority read.`)
    foundInResume.push(`Seniority signal: ${profile.yearsExperienceLabel}`)
  }

  if (tools.length) {
    fitReasons.push(`Tool overlap found: ${tools.join(', ')}.`)
    foundInResume.push(`Tools to emphasize: ${tools.join(', ')}`)
    contributingSignals.push(`Matched tools: ${tools.join(', ')}`)
  }

  if (industries.length) {
    fitReasons.push(`Domain overlap found in the resume and role: ${industries.join(', ')}.`)
    foundInResume.push(`Industry signals: ${industries.join(', ')}`)
    contributingSignals.push(`Matched industries: ${industries.join(', ')}`)
  }

  if (gaps.length) {
    potentialGaps.push(`The job includes signals not clearly found in the parsed resume: ${gaps.join(', ')}.`)
  }

  if (preferences.workMode === 'remote' && !quality.remote) {
    potentialGaps.push('You selected remote, but this posting does not clearly present as remote. It is kept as adjacent/stretch unless other signals are strong.')
  }

  if (quality.weakForProfile) {
    potentialGaps.push('The title is adjacent or less direct for your parsed technical sourcing lane, so it should not be treated as a first-priority exact match.')
  }

  if (quality.clearanceRequired && !profileHasFederalOrClearanceBreadcrumb(profile)) {
    potentialGaps.push('This role appears to require federal, GovCon, DoD, or security-clearance eligibility, but no clearance or GovCon signal was found in the resume text.')
  }

  if (quality.clearanceRequired) {
    cautionNotes.push('Do not imply active clearance. Treat clearance language as a gap unless the candidate can verify it outside the tool.')
  }

  if (quality.seniorityMismatch || breakdown.seniority < 5) {
    potentialGaps.push('Seniority alignment may need review. The job may signal a level below or above the parsed resume lane.')
  }

  if (!salaryPresent(job) && (preferences.salaryMin || preferences.salaryMax)) {
    potentialGaps.push('Salary is not listed, so compensation fit cannot be confirmed from this posting.')
  }

  if (!potentialGaps.length) {
    potentialGaps.push('No major hard gaps were detected from available job metadata, but the posting snippet may be incomplete.')
  }

  foundInResume.push(`Current title signal: ${profile.currentTitle}`)
  if (profile.specialties.length) foundInResume.push(`Specialty signals: ${profile.specialties.slice(0, 4).join(', ')}`)

  const familyAngle = recruitingRoleTaxonomy[jobFamily].resumeAngle
  suggestedPositioning.push(`If true, tailor the resume toward this lane: ${familyAngle}`)
  if (gaps.length) suggestedPositioning.push(`If you have real experience with ${gaps.slice(0, 3).join(', ')}, add it explicitly. Do not add these if they are not true.`)
  if (score < 50 || quality.weakForProfile) suggestedPositioning.push('Consider using this as an adjacent or stretch role rather than the main application lane.')

  cautionNotes.push('Match reasons are generated from parsed resume text and public job metadata. They are not a hiring decision or guarantee.')
  if (profile.clearance.status === 'unverified-breadcrumb') cautionNotes.push(profile.clearance.note)

  return {
    fitReasons: unique(fitReasons).slice(0, 6),
    potentialGaps: unique(potentialGaps).slice(0, 6),
    resumeAngle: {
      foundInResume: unique(foundInResume).slice(0, 6),
      suggestedPositioning: unique(suggestedPositioning).slice(0, 4),
    },
    contributingSignals: unique(contributingSignals).slice(0, 8),
    cautionNotes: unique(cautionNotes).slice(0, 4),
  }
}

export function scoreJobMatch(profile: ResumeProfile, preferences: CareerPreferences, job: MatchableJob): JobMatchResult | null {
  if (!job.title || !job.company || !job.applyUrl) return null
  const jobFamily = inferJobRoleFamily(job)
  const breakdown = buildBreakdown(profile, preferences, job, jobFamily)
  const quality = preferenceQuality(profile, preferences, job, jobFamily)
  const rawScore = Math.max(0, Math.min(100, totalScore(breakdown) + qualityAdjustment(profile, preferences, job, jobFamily)))
  const familyAligned = profile.roleFamilies.includes(jobFamily) || preferences.desiredRoleType === jobFamily
  const adjacentAligned = profile.roleFamilies.some(family => getAdjacentFamilies(family).includes(jobFamily))

  if (rawScore < 18 && !familyAligned && !adjacentAligned && !quality.titleAligned) return null

  const band = capClearedBand(profile, job, jobFamily, bandForScore(rawScore, familyAligned, adjacentAligned, quality))
  return {
    job,
    score: rawScore,
    fitBand: band,
    jobFamily,
    scoreBreakdown: breakdown,
    explanation: buildExplanation(profile, preferences, job, jobFamily, rawScore, breakdown),
    qualityBadges: quality.badges,
  }
}

function mergeJobGroup(jobs: MatchableJob[]): MatchableJob {
  const scored = jobs.map(job => {
    let score = 0
    if (isRemoteJob(job)) score += 30
    if (/united states|\bus\b|usa|remote - us|within canada or united states/i.test(`${job.location} ${job.remoteType}`)) score += 12
    if (salaryPresent(job)) score += 5
    if (!isOnsiteVague(job)) score += 3
    return { job, score }
  }).sort((a, b) => b.score - a.score)

  const base = { ...scored[0].job }
  const locations = unique(jobs.map(job => job.location || '').filter(Boolean))
  const sources = unique(jobs.map(job => job.source || '').filter(Boolean))
  const tags = unique([...(base.tags || []), ...(locations.length > 1 ? [`${locations.length} locations`] : [])])
  const displayLocations = locations.slice(0, 4).join(' | ')
  return {
    ...base,
    location: locations.length > 4 ? `${displayLocations} | +${locations.length - 4} more` : displayLocations || base.location,
    source: sources.length > 1 ? sources.slice(0, 3).join(' + ') : base.source,
    tags,
    alternateLocations: locations,
    collapsedPostingCount: jobs.length,
  }
}

export function dedupeMatchableJobs(jobs: MatchableJob[]): MatchableJob[] {
  const groups = new Map<string, MatchableJob[]>()
  for (const job of jobs) {
    const companyTitleKey = normalizedCompanyTitleKey(job)
    const urlKey = (job.applyUrl || job.sourceUrl || '').toLowerCase().replace(/\?.*$/, '')
    const key = companyTitleKey || urlKey
    if (!key) continue
    groups.set(key, [...(groups.get(key) || []), job])
  }
  return Array.from(groups.values()).map(mergeJobGroup)
}

export function rankJobMatches(profile: ResumeProfile, preferences: CareerPreferences, jobs: MatchableJob[], limit = 25): JobMatchResult[] {
  const matches = dedupeMatchableJobs(jobs)
    .map(job => scoreJobMatch(profile, preferences, job))
    .filter((match): match is JobMatchResult => Boolean(match))
    .sort((a, b) => {
      const aq = preferenceQuality(profile, preferences, a.job, a.jobFamily)
      const bq = preferenceQuality(profile, preferences, b.job, b.jobFamily)
      if (aq.bestFitEligible !== bq.bestFitEligible) return aq.bestFitEligible ? -1 : 1
      if (aq.remote !== bq.remote && preferences.workMode === 'remote') return aq.remote ? -1 : 1
      return b.score - a.score
    })

  return matches.slice(0, limit)
}

function queryFamilies(profile: ResumeProfile, preferences: CareerPreferences, rescueTier: 0 | 1 | 2): RecruitingRoleFamily[] {
  const desired = preferences.desiredRoleType && preferences.desiredRoleType !== 'any' ? preferences.desiredRoleType : null
  const base = unique<RecruitingRoleFamily>([
    ...(desired ? [desired] : []),
    profile.primaryFamily,
    ...profile.roleFamilies,
  ])

  const tierOne = unique<RecruitingRoleFamily>([
    ...base,
    ...base.flatMap(getAdjacentFamilies),
    'sourcer',
    'technical-sourcer',
    'recruiter',
    'talent-intelligence',
    'recruiting-ops',
  ])

  const tierTwo = unique<RecruitingRoleFamily>([
    ...tierOne,
    'remote-recruiter',
    'rpo-recruiter',
    'govcon-recruiter',
    'healthcare-recruiter',
    'ai-recruiter',
  ])

  if (rescueTier === 0) return base
  if (rescueTier === 1) return tierOne
  return tierTwo
}

export function buildCareerMatchQueries(profile: ResumeProfile, preferences: CareerPreferences, rescueTier: 0 | 1 | 2 = 0): string[] {
  const families = queryFamilies(profile, preferences, rescueTier)
  const querySet: string[] = []

  for (const family of families) {
    const entry = recruitingRoleTaxonomy[family]
    querySet.push(...entry.searchTerms)
    querySet.push(...ROLE_QUERY_EXPANSIONS[family])
  }

  if (profile.seniority === 'senior-ic' || profile.seniority === 'lead' || profile.seniority === 'manager') {
    querySet.push('senior recruiter', 'senior sourcer', 'lead sourcer', 'sourcing manager')
  }

  if (profile.industries.includes('federal') || profile.clearance.status === 'unverified-breadcrumb' || preferences.clearedFederalInterest) {
    querySet.push('federal recruiter', 'cleared recruiter', 'cleared sourcer', 'govcon recruiter')
  }
  if (profile.industries.includes('healthcare') || /healthcare|clinical|nurse/i.test(preferences.industryFocus || '')) {
    querySet.push('healthcare recruiter', 'clinical recruiter', 'nurse recruiter')
  }
  if (profile.industries.includes('data') || /ai|machine learning|ml|data/i.test(preferences.industryFocus || '')) {
    querySet.push('ai recruiter', 'machine learning recruiter', 'data recruiter', 'ai sourcer')
  }
  if (/rpo|agency|staffing|contract/i.test(`${preferences.industryFocus || ''} ${profile.specialties.join(' ')}`)) {
    querySet.push('rpo recruiter', 'contract recruiter', 'staffing recruiter', 'agency recruiter')
  }

  for (const tool of profile.tools.slice(0, 4)) {
    querySet.push(`${tool} recruiter`, `${tool} sourcer`)
  }

  return unique(querySet.map(query => query.toLowerCase())).slice(0, rescueTier === 0 ? 10 : rescueTier === 1 ? 22 : 38)
}

export function suggestAdjacentRoles(profile: ResumeProfile, preferences: CareerPreferences, limit = 6): AdjacentRole[] {
  const primary = preferences.desiredRoleType && preferences.desiredRoleType !== 'any'
    ? preferences.desiredRoleType
    : profile.primaryFamily

  const candidates = unique<RecruitingRoleFamily>([
    ...getAdjacentFamilies(primary),
    ...profile.roleFamilies.flatMap(getAdjacentFamilies),
    'talent-intelligence',
    'recruiting-ops',
    'rpo-recruiter',
    'remote-recruiter',
  ])
    .filter(family => family !== primary)
    .filter(family => !profile.roleFamilies.includes(family) || family === 'talent-intelligence' || family === 'recruiting-ops')

  return candidates.slice(0, limit).map(family => {
    const entry = recruitingRoleTaxonomy[family]
    const overlap = unique([
      ...profile.tools.filter(tool => entry.toolSignals.some(signal => signal.toLowerCase() === tool.toLowerCase() || signal.toLowerCase().includes(tool.toLowerCase()))),
      ...profile.industries.filter(industry => entry.industrySignals.includes(industry)),
      ...profile.specialties.filter(specialty => entry.skillSignals.some(signal => specialty.toLowerCase().includes(signal))),
    ])

    const whyItFits = overlap.length
      ? [`Your resume already has bridge signals for this lane: ${overlap.slice(0, 4).join(', ')}.`]
      : [`This is a common adjacent move from ${getRoleFamilyLabel(profile.primaryFamily)} when the resume shows transferable recruiting systems, research, or stakeholder experience.`]

    return {
      family,
      label: entry.label,
      fitBand: 'Adjacent Fit',
      whyItFits,
      bridgeNote: entry.resumeAngle,
      searchTerms: entry.searchTerms,
    }
  })
}

export function buildJobSearchQuery(profile: ResumeProfile, preferences: CareerPreferences): string {
  return buildCareerMatchQueries(profile, preferences, 0).slice(0, 4).join(' ')
}

function groupForMatch(match: JobMatchResult, profile: ResumeProfile, preferences?: CareerPreferences): MatchGroupId {
  const quality = preferenceQuality(profile, preferences || {}, match.job, match.jobFamily)
  if (quality.clearanceRequired || match.jobFamily === 'govcon-recruiter') return 'federal-cleared'
  if (match.score >= 68 && quality.bestFitEligible) return 'best-fits'
  if (match.jobFamily === 'sourcer' || match.jobFamily === 'technical-sourcer' || match.jobFamily === 'ai-recruiter') return 'sourcing'
  if (match.jobFamily === 'recruiting-ops' || match.jobFamily === 'talent-intelligence') return 'ops-intelligence'
  if (match.jobFamily === 'rpo-recruiter' || /contract|rpo|agency|staffing|embedded/i.test(textForJob(match.job))) return 'rpo-contract-agency'
  if (quality.weakForProfile || quality.seniorityMismatch || quality.internationalForRemote || match.fitBand === 'Stretch') return 'domain-shift-stretch'
  if (match.jobFamily === 'recruiter' || match.jobFamily === 'remote-recruiter' || /talent acquisition|ta partner|full.?cycle/i.test(match.job.title)) return 'recruiting'
  return 'domain-shift-stretch'
}

const GROUP_META: Record<MatchGroupId, { label: string; description: string }> = {
  'best-fits': {
    label: 'Best Fits',
    description: 'Direct title, seniority, remote/location, and signal matches for your current recruiting lane.',
  },
  sourcing: {
    label: 'Sourcing Roles',
    description: 'Talent sourcer, technical sourcer, engineering sourcer, AI sourcer, and sourcing-heavy roles.',
  },
  recruiting: {
    label: 'Recruiting Roles',
    description: 'Full-cycle recruiter, TA partner, corporate recruiter, and remote recruiter roles you may fit.',
  },
  'ops-intelligence': {
    label: 'Ops & Intelligence',
    description: 'Recruiting operations, talent intelligence, market mapping, enablement, and systems roles.',
  },
  'federal-cleared': {
    label: 'Federal / Cleared',
    description: 'GovCon, defense, federal, public sector, and cleared recruiting lanes. Clearance remains unverified.',
  },
  'rpo-contract-agency': {
    label: 'RPO / Contract / Agency',
    description: 'Embedded, RPO, staffing, agency, contract, and fractional recruiting roles.',
  },
  'domain-shift-stretch': {
    label: 'Domain Shift / Stretch',
    description: 'Lower-priority roles with transferable recruiting signals, weaker title fit, location mismatch, or higher stretch.',
  },
}

export function groupJobMatches(matches: JobMatchResult[], profile: ResumeProfile, preferences: CareerPreferences = {}): MatchGroup[] {
  const grouped = new Map<MatchGroupId, JobMatchResult[]>()
  for (const match of matches) {
    const group = groupForMatch(match, profile, preferences)
    grouped.set(group, [...(grouped.get(group) || []), match])
  }
  const order: MatchGroupId[] = ['best-fits', 'sourcing', 'recruiting', 'ops-intelligence', 'federal-cleared', 'rpo-contract-agency', 'domain-shift-stretch']
  return order
    .map(id => ({ id, ...GROUP_META[id], matches: grouped.get(id) || [] }))
    .filter(group => group.matches.length > 0)
}

function matchLabel(match: JobMatchResult): string {
  return `${match.job.company} — ${match.job.title}`
}

export function buildRoleUniverse(profile: ResumeProfile, preferences: CareerPreferences, matches: JobMatchResult[], queries: string[]): CareerMatchRoleUniverse {
  const familyCounts = new Map<RecruitingRoleFamily, number>()
  for (const match of matches) familyCounts.set(match.jobFamily, (familyCounts.get(match.jobFamily) || 0) + 1)
  const viable = Array.from(familyCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([family]) => getRoleFamilyLabel(family))

  const adjacentLabels = suggestAdjacentRoles(profile, preferences, 6).map(role => role.label)
  const strongestSignals = unique([
    ...profile.specialties.slice(0, 4),
    ...profile.tools.slice(0, 6),
    ...profile.industries.slice(0, 4),
    profile.clearance.status === 'unverified-breadcrumb' ? 'Federal / clearance breadcrumbs' : '',
  ])

  const exact = matches.filter(match => preferenceQuality(profile, preferences, match.job, match.jobFamily).titleAligned).slice(0, 4).map(matchLabel)
  const remote = matches.filter(match => isRemoteJob(match.job)).slice(0, 4).map(matchLabel)
  const adjacent = Array.from(new Set(matches
    .filter(match => !preferenceQuality(profile, preferences, match.job, match.jobFamily).bestFitEligible)
    .map(match => getRoleFamilyLabel(match.jobFamily))))
    .slice(0, 4)

  return {
    strongestLane: getRoleFamilyLabel(profile.primaryFamily),
    alsoViable: unique([...viable.filter(label => label !== getRoleFamilyLabel(profile.primaryFamily)), ...adjacentLabels]).slice(0, 6),
    stretchLanes: unique(['Sourcing Manager', 'TA Program Manager', 'Recruiting Enablement', 'Talent Intelligence'].filter(label => !viable.includes(label))).slice(0, 4),
    strongestSignals: strongestSignals.slice(0, 10),
    queryLanes: queries.slice(0, 18),
    bestExactMatches: exact,
    bestRemoteMatches: remote,
    bestAdjacentLanes: adjacent,
    stretchReason: 'Stretch results are included when rescue search finds transferable recruiting signals but weaker title, seniority, domain, remote/location, or clearance alignment.',
  }
}
