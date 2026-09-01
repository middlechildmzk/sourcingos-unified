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

function naturalLanguageLocation(rawText: string): string {
  const compact = clean(rawText, 700)
  const match = compact.match(/\b(?:in|near|around|based\s+in)\s+([a-z][a-z .'-]{1,60}?)(?=\s+(?:with|who|that|from|and|but|where)\b|[,.;]|$)/i)
  if (!match?.[1]) return ''
  const value = clean(match[1], 80)
  if (/^(the|a|an|this|that|production|cloud|security|engineering)$/i.test(value)) return ''
  return titleCaseFirst(value)
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
  const naturalLocation = naturalLanguageLocation(rawText)
  const explicitLocation = labeledLocation(rawText)
  const location = (natural ? naturalLocation || explicitLocation || parsed.location : explicitLocation || parsed.location || naturalLocation) || 'Not specified'
  const clearance = parsed.clearance[0] || labeledValue(rawText, ['clearance', 'security clearance'], 100) || 'Not specified'
  const targetCompanies = labeledValues(rawText, ['target companies', 'target company', 'donor companies', 'companies'])
  const disqualifiers = labeledValues(rawText, ['disqualifiers', 'exclude', 'avoid'])
  const explicitAdjacent = labeledValues(rawText, ['adjacent backgrounds', 'adjacent titles', 'adjacent roles'])
  const explicitPreferenceLanguage = /\b(?:ideally|preferably|nice[ -]to[ -]have|bonus|optional)\b/i.test(rawText)
  // In a short natural-language command, recognized technologies are literal
  // requested attributes. Treat them as proposed must-haves unless the recruiter
  // explicitly marks part of the sentence as preferred; the next UI step still
  // requires recruiter confirmation before the role is committed.
  const parsedMustHaves = natural && !explicitPreferenceLanguage
    ? uniq([...parsed.mustHaveSkills, ...parsed.preferredSkills], 16)
    : uniq(parsed.mustHaveSkills, 16)
  // Explicit quantified recruiter language such as "5+ years of Linux" must
  // survive taxonomy/model misses. This is role-intake truth, not candidate truth.
  const mustHaves = mergeExplicitExperienceRequirements(parsedMustHaves, rawText, 16)
  const niceToHaves = natural && !explicitPreferenceLanguage ? [] : uniq(parsed.preferredSkills, 16)

  const intake: RoleIntake = {
    title: naturalTitle || clean(parsed.roleTitle, 100) || 'Untitled role',
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
