import 'server-only'
import { callModelJson } from './provider'
import { interpretRoleBrief } from '@/lib/role-brief-v33'
import { mergeExplicitExperienceRequirements } from '@/lib/explicit-role-requirements-v33-6'
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

/**
 * Short recruiter commands are closer to a search contract than a prose JD.
 * The deterministic parser is intentionally conservative and literal, so its
 * consequential fields remain authoritative. The model may explain/enrich the
 * request, but it must never replace an explicit RHEL requirement with
 * TypeScript, Secret with TS/SCI, Annapolis Junction with no location, etc.
 */
export function shortRecruiterBriefV33_11(rawText: string): boolean {
  const lines = rawText.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const compact = rawText.replace(/\s+/g, ' ').trim()
  return lines.length <= 3 && compact.length > 0 && compact.length <= 800
}

export function mergeAiRoleBriefV33_11(
  rawText: string,
  model: Record<string, unknown>,
): RoleIntake {
  const fallback = interpretRoleBrief(rawText).intake
  const shortBrief = shortRecruiterBriefV33_11(rawText)
  const modelMustHaves = strings(model.mustHaves, fallback.mustHaves, 16)

  if (shortBrief) {
    return {
      title: fallback.title,
      location: fallback.location,
      workMode: fallback.workMode,
      compensation: fallback.compensation,
      clearance: fallback.clearance,
      mustHaves: [...fallback.mustHaves],
      niceToHaves: [...fallback.niceToHaves],
      disqualifiers: [...fallback.disqualifiers],
      targetCompanies: [...fallback.targetCompanies],
      // Adjacent titles are retrieval expansion only, not candidate facts or
      // requirements, so model suggestions may augment the deterministic set.
      adjacentBackgrounds: Array.from(new Set([
        ...fallback.adjacentBackgrounds,
        ...strings(model.adjacentBackgrounds, [], 16),
      ])).slice(0, 16),
      hiringManagerNotes: clean(model.hiringManagerNotes, '', 600),
      rawDescription: rawText,
    }
  }

  return {
    title: clean(model.title, fallback.title, 100) || fallback.title,
    location: clean(model.location, fallback.location, 120) || 'Not specified',
    workMode: workMode(model.workMode, fallback.workMode),
    compensation: clean(model.compensation, fallback.compensation, 120) || 'Not specified',
    clearance: clean(model.clearance, fallback.clearance, 100) || 'Not specified',
    mustHaves: mergeExplicitExperienceRequirements(modelMustHaves, rawText, 16),
    niceToHaves: strings(model.niceToHaves, fallback.niceToHaves, 16),
    disqualifiers: strings(model.disqualifiers, fallback.disqualifiers, 12),
    targetCompanies: strings(model.targetCompanies, fallback.targetCompanies, 12),
    adjacentBackgrounds: strings(model.adjacentBackgrounds, fallback.adjacentBackgrounds, 16),
    hiringManagerNotes: clean(model.hiringManagerNotes, '', 600),
    rawDescription: rawText,
  }
}

export async function parseRoleBriefWithAiV33_4(rawText: string): Promise<ParsedRoleBriefV33_4> {
  const fallback = interpretRoleBrief(rawText)
  const prompt = `You are the intake parser for an evidence-first talent sourcing product. Convert the recruiter's request into a compact structured Role Brief.

Rules:
- Return JSON only.
- Extract only what the recruiter actually stated or what is a conservative normalization of their wording.
- Do not invent requirements, employers, years, compensation, geography, clearance, citizenship, or disqualifiers.
- Preserve explicit quantified experience requirements. Example: "5+ years of Linux" must remain a must-have such as "5+ years Linux experience"; never drop the number or capability.
- Do not turn preference language into a must-have.
- Security clearance/citizenship are role requirements only; never claim candidate verification.
- Keep mustHaves concise capability phrases, ideally 2-6.
- Keep niceToHaves separate.
- adjacentBackgrounds may include close title synonyms, but must stay in the same job family. Never expand a technical administrator into education, school, office, or business administration titles.
- Ask a follow-up question ONLY when an ambiguity would materially change who gets searched. Missing optional information is not a blocker.
- Maximum 2 follow-up questions.
- IMPORTANT: the deterministic baseline below contains literal recruiter-stated constraints. Never replace an explicit baseline capability, location, work mode, quantified experience requirement, or clearance with a different value. Your output may conservatively enrich long-form JDs, but explicit recruiter text wins.

Recruiter request:
${JSON.stringify(rawText)}

Deterministic parser baseline (explicit recruiter-stated values are authoritative):
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
  const intake = mergeAiRoleBriefV33_11(rawText, data)

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
