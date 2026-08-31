import 'server-only'
import { callModelJson } from './provider'
import { interpretRoleBrief } from '@/lib/role-brief-v33'
import type { RoleIntake } from '@/lib/role-workspace'

export type ParsedRoleBriefV33_4 = {
  intake: RoleIntake
  questions: string[]
  aiGenerated: boolean
  summary: string
}

function clean(value: unknown, fallback = '', max = 240): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : fallback
}

function strings(value: unknown, fallback: string[] = [], max = 20): string[] {
  if (!Array.isArray(value)) return fallback
  return Array.from(new Set(value.filter(item => typeof item === 'string').map(item => clean(item, '', 160)).filter(Boolean))).slice(0, max)
}

function workMode(value: unknown, fallback: RoleIntake['workMode']): RoleIntake['workMode'] {
  return value === 'remote' || value === 'hybrid' || value === 'onsite' || value === 'flexible' || value === 'unknown' ? value : fallback
}

function compactSummary(intake: RoleIntake): string {
  const parts = [
    intake.title,
    intake.location !== 'Not specified' ? intake.location : '',
    intake.workMode !== 'unknown' ? intake.workMode : '',
    intake.mustHaves.length ? `${intake.mustHaves.slice(0, 4).join(', ')}${intake.mustHaves.length > 4 ? ` +${intake.mustHaves.length - 4}` : ''}` : '',
    intake.clearance !== 'Not specified' ? `${intake.clearance} (verification required)` : '',
  ].filter(Boolean)
  return parts.join(' · ')
}

export async function parseRoleBriefWithAiV33_4(rawText: string): Promise<ParsedRoleBriefV33_4> {
  const fallback = interpretRoleBrief(rawText)
  const prompt = `You are the intake parser for an evidence-first talent sourcing product. Convert the recruiter's request into a compact structured Role Brief.

Rules:
- Return JSON only.
- Extract only what the recruiter actually stated or what is a conservative normalization of their wording.
- Do not invent requirements, employers, years, compensation, geography, clearance, citizenship, or disqualifiers.
- Do not turn preference language into a must-have.
- Security clearance/citizenship are role requirements only; never claim candidate verification.
- Keep mustHaves concise capability phrases, ideally 2-6.
- Keep niceToHaves separate.
- adjacentBackgrounds may include close title synonyms, but must not become requirements.
- Ask a follow-up question ONLY when an ambiguity would materially change who gets searched. Missing optional information is not a blocker.
- Maximum 2 follow-up questions.

Recruiter request:
${JSON.stringify(rawText)}

Deterministic parser baseline (use as a safety reference, not as authoritative truth):
${JSON.stringify(fallback.intake)}

Return exactly this shape:
{
  "title": string,
  "location": string,
  "workMode": "remote"|"hybrid"|"onsite"|"flexible"|"unknown",
  "compensation": string,
  "clearance": string,
  "mustHaves": string[],
  "niceToHaves": string[],
  "disqualifiers": string[],
  "targetCompanies": string[],
  "adjacentBackgrounds": string[],
  "hiringManagerNotes": string,
  "questions": string[]
}`

  const result = await callModelJson<Record<string, unknown>>(prompt, 1400)
  if (!result.ok || !result.data) {
    return {
      intake: fallback.intake,
      questions: fallback.questions.filter(question => /target role title|must-have/i.test(question)).slice(0, 2),
      aiGenerated: false,
      summary: compactSummary(fallback.intake),
    }
  }

  const data = result.data
  const intake: RoleIntake = {
    title: clean(data.title, fallback.intake.title, 100) || fallback.intake.title,
    location: clean(data.location, fallback.intake.location, 120) || 'Not specified',
    workMode: workMode(data.workMode, fallback.intake.workMode),
    compensation: clean(data.compensation, fallback.intake.compensation, 120) || 'Not specified',
    clearance: clean(data.clearance, fallback.intake.clearance, 100) || 'Not specified',
    mustHaves: strings(data.mustHaves, fallback.intake.mustHaves, 16),
    niceToHaves: strings(data.niceToHaves, fallback.intake.niceToHaves, 16),
    disqualifiers: strings(data.disqualifiers, fallback.intake.disqualifiers, 12),
    targetCompanies: strings(data.targetCompanies, fallback.intake.targetCompanies, 12),
    adjacentBackgrounds: strings(data.adjacentBackgrounds, fallback.intake.adjacentBackgrounds, 16),
    hiringManagerNotes: clean(data.hiringManagerNotes, '', 600),
    rawDescription: rawText,
  }

  const questions = strings(data.questions, [], 2).filter(question => question.endsWith('?'))
  if ((!intake.title || intake.title === 'Untitled role') && !questions.some(question => /title|role/i.test(question))) questions.unshift('What is the primary role title you want me to anchor the search around?')
  if (!intake.mustHaves.length && !questions.some(question => /must|require|non-negotiable/i.test(question))) questions.push('What is the one capability this person absolutely needs?')

  return {
    intake,
    questions: questions.slice(0, 2),
    aiGenerated: true,
    summary: compactSummary(intake),
  }
}
