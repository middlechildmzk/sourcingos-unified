import { parseJobDescription } from './jd-parser'
import { mergeExplicitExperienceRequirements } from './explicit-role-requirements-v33-6'
import type { RoleIntake } from './role-workspace'

export type RoleBriefInterpretation = {
  intake: RoleIntake
  mode: 'natural_language' | 'job_description'
  questions: string[]
  detected: {
    seniority: string
    industries: string[]
    relatedTitles: string[]
    suggestedSourceLanes: string[]
  }
}

function clean(value: string, max = 240): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

function uniq(values: string[], max = 20): string[] {
  return Array.from(new Set(values.map(value => clean(value)).filter(Boolean))).slice(0, max)
}

function titleCaseFirst(value: string): string {
  const cleanValue = clean(value, 100)
  return cleanValue ? `${cleanValue[0].toUpperCase()}${cleanValue.slice(1)}` : ''
}

function naturalLanguageTitle(rawText: string): string {
  const compact = clean(rawText, 500)
  const patterns = [
    /^(?:find|source|show)\s+(?:me\s+)?(?:an?\s+)?(.+?)(?=\s+(?:in|near|around|based\s+in|with|who|that|from)\b|[,.;]|$)/i,
    /^(?:i\s+need|we\s+need|looking\s+for|i(?:'m|\s+am)\s+looking\s+for)\s+(?:an?\s+)?(.+?)(?=\s+(?:in|near|around|based\s+in|with|who|that|from)\b|[,.;]|$)/i,
    /^(?:help\s+me\s+find)\s+(?:an?\s+)?(.+?)(?=\s+(?:in|near|around|based\s+in|with|who|that|from)\b|[,.;]|$)/i,
  ]
  for (const pattern of patterns) {
    const match = compact.match(pattern)
    if (match?.[1] && match[1].length >= 3 && match[1].length <= 100) return titleCaseFirst(match[1])
  }
  return ''
}

function terseRoleTitle(rawText: string): string {
  const compact = clean(rawText, 500)
  if (!compact || rawText.split(/\r?\n/).filter(line => line.trim()).length > 2) return ''
  const match = compact.match(/^(.+?)(?=\s+(?:in|near|around|based\s+in|with|who|that|from)\b|[,.;]|$)/i)
  if (!match?.[1]) return ''
  const value = clean(match[1], 100)
  if (value.length < 3 || value.length > 80 || /^(title|role|location|job description)$/i.test(value)) return ''
  return titleCaseFirst(value)
}

function normalizeLocationValue(city: string, region = ''): string {
  const base = clean(city, 80)
    .replace(/\s+(?:area|metro(?:\s+area)?|region)$/i, '')
    .trim()
  if (!base || /^(the|a|an|this|that|production|cloud|security|engineering|experience)$/i.test(base)) return ''
  const titled = base.replace(/\b[a-z]/g, letter => letter.toUpperCase())
  return region ? `${titled}, ${region.toUpperCase()}` : titled
}

function naturalLanguageLocation(rawText: string): string {
  const compact = clean(rawText, 700)
  // Prefer explicit proximity phrases before generic "in" so recruiter language
  // such as "5+ years of experience in or near Annapolis Junction, MD" cannot
  // collapse into the literal string "or near Annapolis Junction". "Local to"
  // is also recruiter proximity language and must stop before an explicit
  // alternative market such as "or greater Washington DC".
  const patterns = [
    /\b(?:in\s+or\s+near|near|around|based\s+in|local(?:ly)?\s+to)\s+([a-z][a-z .'-]{1,60}?)(?:\s*,\s*([a-z]{2}))?(?=\s+(?:with|who|that|from|and|but|where|or)\b|[.;]|$)/i,
    /\bin\s+([a-z][a-z .'-]{1,60}?)(?:\s*,\s*([a-z]{2}))?(?=\s+(?:with|who|that|from|and|but|where|or)\b|[.;]|$)/i,
  ]
  for (const pattern of patterns) {
    const match = compact.match(pattern)
    if (!match?.[1]) continue
    const value = normalizeLocationValue(match[1], match[2] || '')
    if (value) return value
  }
  return ''
}

function labeledValue(rawText: string, labels: string[], max = 100): string {
  const escaped = labels.map(label => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const match = rawText.match(new RegExp(`(?:^|\\n)\\s*(?:${escaped})\\s*[:\\-]\\s*([^\\n]+)`, 'i'))
  return match?.[1] ? clean(match[1], max) : ''
}

function labeledLocation(rawText: string): string {
  const value = labeledValue(rawText, ['location', 'job location'], 120)
  if (!value) return ''
  return clean(value.replace(/\s*\/\s*(?:hybrid|remote|on[ -]?site|in[ -]?office)\b.*$/i, ''), 100)
}

function labeledValues(rawText: string, labels: string[]): string[] {
  const value = labeledValue(rawText, labels, 500)
  if (!value) return []
  return uniq(value.split(/,|;|\||\bor\b/i).map(item => item.trim()), 12)
}

function literalTechnicalMustHaves(rawText: string): string[] {
  const values: string[] = []
  if (/\b(?:rhel|red\s+hat\s+enterprise\s+linux)\b/i.test(rawText)) values.push('RHEL')
  else if (/\bred\s+hat\b/i.test(rawText)) values.push('Red Hat')
  if (/\blinux\b/i.test(rawText) && !/\bred\s+hat\s+enterprise\s+linux\b/i.test(rawText)) values.push('Linux')
  if (/\bunix\b/i.test(rawText)) values.push('Unix')
  return uniq(values, 8)
}

function genericExperienceRequirement(rawText: string): string {
  const match = rawText.match(/\b(\d{1,2})\s*(\+)?\s*(?:years?|yrs?)\s+of\s+(?:relevant\s+|professional\s+|overall\s+)?experience\b/i)
  if (!match?.[1]) return ''
  const years = Number(match[1])
  if (!Number.isInteger(years) || years < 1 || years > 50) return ''
  return `${years}${match[2] ? '+' : ''} years relevant experience`
}

function normalizeClearanceLevel(value: string): string {
  const normalized = value.toLowerCase().replace(/\s+/g, ' ').trim()
  if (/^(?:ts\s*\/\s*sci|top secret\s*\/\s*sci)$/.test(normalized)) return 'TS/SCI'
  if (/^top secret$/.test(normalized)) return 'Top Secret'
  if (/^secret$/.test(normalized)) return 'Secret'
  if (/^public trust$/.test(normalized)) return 'Public Trust'
  return ''
}

function explicitClearance(rawText: string): string {
  // When the recruiter states a floor (for example "Secret clearance or higher")
  // preserve that floor even if a stronger example appears later in parentheses
  // such as "(TS/SCI)". A parenthetical example must never silently tighten the
  // candidate pool.
  const floor = rawText.match(/\b(public\s+trust|secret|top\s+secret|ts\s*\/\s*sci|top\s+secret\s*\/\s*sci)(?:\s+(?:security\s+)?clearance)?\s+or\s+(?:higher|above|greater)\b/i)
  if (floor?.[1]) {
    const level = normalizeClearanceLevel(floor[1])
    if (level) return `${level} or higher`
  }

  let level = ''
  if (/\b(?:ts\s*\/\s*sci|top\s+secret\s*\/\s*sci)\b/i.test(rawText)) level = 'TS/SCI'
  else if (/\btop\s+secret(?:\s+security)?\s+clearance\b|\bactive\s+top\s+secret\b/i.test(rawText)) level = 'Top Secret'
  else if (/\bsecret(?:\s+security)?\s+clearance\b|\bactive\s+secret\b|\bdod\s+secret\b/i.test(rawText)) level = 'Secret'
  else if (/\bpublic\s+trust\b/i.test(rawText)) level = 'Public Trust'
  return level
}

function workMode(rawText: string): RoleIntake['workMode'] {
  if (/\bhybrid\b/i.test(rawText)) return 'hybrid'
  if (/\bremote\b|work\s+from\s+home/i.test(rawText)) return 'remote'
  if (/\bon[ -]?site\b|\bin[ -]?office\b/i.test(rawText)) return 'onsite'
  return 'unknown'
}

function compensation(rawText: string): string {
  const labeled = labeledValue(rawText, ['compensation', 'salary', 'pay range'], 120)
  if (labeled) return labeled
  const range = rawText.match(/\$\s?[\d,]+(?:\.\d+)?\s*(?:-|–|to)\s*\$?\s?[\d,]+(?:\.\d+)?(?:\s*(?:per\s+year|annually|\/yr|\/hour|\/hr))?/i)?.[0]
  return range ? clean(range, 120) : 'Not specified'
}

function reviewQuestions(rawText: string, intake: RoleIntake): string[] {
  const questions: string[] = []
  if (!intake.title) questions.push('Confirm the target role title before approving the search plan.')
  if (!intake.mustHaves.length) questions.push('Confirm at least one recruiter-approved must-have capability before running external research.')
  if (intake.location === 'Not specified') questions.push('Confirm whether geography or work mode should constrain the search.')
  if (/\b(?:probably|ideally|preferably|maybe|not\s+(?:a|an)|isn['’]?t|avoid|exclude)\b/i.test(rawText)) {
    questions.push('Review preference or exclusion language in the brief before treating it as a hard requirement or disqualifier.')
  }
  if (/\b(?:clearance|ts\/?sci|top secret|secret|public trust|polygraph|citizenship|citizen)\b/i.test(rawText)) {
    questions.push('Security or citizenship language is search context only until verified through the proper authoritative process.')
  }
  return uniq(questions, 6)
}

function isNaturalLanguageBrief(rawText: string): boolean {
  const compact = clean(rawText, 500)
  const lines = rawText.split(/\r?\n/).filter(line => line.trim()).length
  return lines <= 3 && /^(?:find|source|show|help\s+me\s+find|i\s+need|we\s+need|looking\s+for|i(?:'m|\s+am)\s+looking\s+for)\b/i.test(compact)
}

/**
 * Deterministic Role Brain entry point for both pasted JDs and natural-language
 * recruiter briefs. It reuses the shared JD taxonomy/parser and keeps uncertain
 * preference language as review questions rather than silently hardening it into
 * consequential role criteria.
 */
export function interpretRoleBrief(rawText: string): RoleBriefInterpretation {
  const parsed = parseJobDescription(rawText)
  const natural = isNaturalLanguageBrief(rawText)
  const naturalTitle = naturalLanguageTitle(rawText)
  // Recruiters often type the role directly ("RHEL admin in Washington DC")
  // without a conversational prefix. Keep that valid shorthand from falling
  // through to "Untitled role" and forcing a meaningless edit/retry loop.
  const directTitle = terseRoleTitle(rawText)
  const commandStyle = natural || Boolean(directTitle)
  const naturalLocation = naturalLanguageLocation(rawText)
  const explicitLocation = labeledLocation(rawText)
  const location = (commandStyle ? naturalLocation || explicitLocation || parsed.location : explicitLocation || parsed.location || naturalLocation) || 'Not specified'
  const clearance = explicitClearance(rawText) || parsed.clearance[0] || labeledValue(rawText, ['clearance', 'security clearance'], 100) || 'Not specified'
  const targetCompanies = labeledValues(rawText, ['target companies', 'target company', 'donor companies', 'companies'])
  const disqualifiers = labeledValues(rawText, ['disqualifiers', 'exclude', 'avoid'])
  const explicitAdjacent = labeledValues(rawText, ['adjacent backgrounds', 'adjacent titles', 'adjacent roles'])
  const explicitPreferenceLanguage = /\b(?:ideally|preferably|nice[ -]to[ -]have|bonus|optional)\b/i.test(rawText)
  // Short recruiter commands often contain literal technologies that are absent
  // from the shared taxonomy. Preserve those literal requested capabilities as
  // proposed must-haves rather than silently dropping them before search.
  const commandTechnical = commandStyle && !explicitPreferenceLanguage ? literalTechnicalMustHaves(rawText) : []
  const parsedMustHaves = commandStyle && !explicitPreferenceLanguage
    ? uniq([...parsed.mustHaveSkills, ...parsed.preferredSkills, ...commandTechnical], 16)
    : uniq(parsed.mustHaveSkills, 16)
  // Explicit quantified recruiter language such as "5+ years of Linux" must
  // survive taxonomy/model misses. A generic "5+ years of experience" remains a
  // separate role requirement; it is not falsely converted into 5+ years of RHEL.
  let mustHaves = mergeExplicitExperienceRequirements(parsedMustHaves, rawText, 16)
  const genericExperience = genericExperienceRequirement(rawText)
  if (genericExperience && !mustHaves.some(item => /^\d{1,2}\+?\s+years\b/i.test(item))) {
    mustHaves = uniq([genericExperience, ...mustHaves], 16)
  }
  const niceToHaves = commandStyle && !explicitPreferenceLanguage ? [] : uniq(parsed.preferredSkills, 16)

  const intake: RoleIntake = {
    title: naturalTitle || directTitle || clean(parsed.roleTitle, 100) || 'Untitled role',
    location,
    workMode: workMode(rawText),
    compensation: compensation(rawText),
    clearance,
    mustHaves,
    niceToHaves,
    disqualifiers,
    targetCompanies: uniq([...parsed.targetCompanies, ...targetCompanies], 12),
    adjacentBackgrounds: uniq([...explicitAdjacent, ...parsed.relatedTitles], 16),
    hiringManagerNotes: '',
    rawDescription: rawText,
  }

  return {
    intake,
    mode: natural ? 'natural_language' : 'job_description',
    questions: reviewQuestions(rawText, intake),
    detected: {
      seniority: parsed.seniority,
      industries: parsed.industries,
      relatedTitles: parsed.relatedTitles,
      suggestedSourceLanes: parsed.suggestedSourceLanes,
    },
  }
}
