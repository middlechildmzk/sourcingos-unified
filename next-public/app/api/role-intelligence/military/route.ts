import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth-gate'
import { militaryLaneDrafts } from '@/lib/military-talent-intelligence-v33'
import { buildRoleMilitaryHypothesis } from '@/lib/military-role-hypothesis-v33'
import { militaryTalentGate } from '@/lib/military-role-gating-v33'
import { loadMilitaryOccupationIndex } from '@/lib/onet-military-dataset-v33'
import { rateLimit } from '@/lib/rate-limit'
import type { RoleIntake } from '@/lib/role-workspace'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const intakeSchema = z.object({
  title: z.string().trim().min(2).max(160),
  location: z.string().max(240).default('Not specified'),
  workMode: z.enum(['remote', 'hybrid', 'onsite', 'flexible', 'unknown']).default('unknown'),
  compensation: z.string().max(240).default('Not specified'),
  clearance: z.string().max(240).default('Not specified'),
  mustHaves: z.array(z.string().trim().min(1).max(180)).max(30).default([]),
  niceToHaves: z.array(z.string().trim().min(1).max(180)).max(30).default([]),
  disqualifiers: z.array(z.string().trim().min(1).max(180)).max(20).default([]),
  targetCompanies: z.array(z.string().trim().min(1).max(180)).max(30).default([]),
  adjacentBackgrounds: z.array(z.string().trim().min(1).max(180)).max(30).default([]),
  hiringManagerNotes: z.string().max(8_000).default(''),
  rawDescription: z.string().max(30_000).default(''),
})

const requestSchema = z.object({
  intake: intakeSchema,
  onetOccupation: z.object({
    code: z.string().trim().min(2).max(20),
    title: z.string().trim().min(2).max(180),
  }).optional(),
})

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  const parsed = requestSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid military role-intelligence request.' }, { status: 400 })

  const intake = parsed.data.intake as RoleIntake
  const domainGate = militaryTalentGate(intake)
  if (!domainGate.enabled) {
    return NextResponse.json({
      ok: true,
      gate: domainGate,
      dataset: null,
      hypothesis: {
        applicable: false,
        reason: 'Military talent intelligence is gated to federal/cleared work and technical cybersecurity roles.',
        roleConcepts: [], occupations: [], transferableSkillConcepts: [], verificationQuestions: [], doNotAssume: [], provisionalDataInUse: false, attribution: '',
      },
      drafts: [],
    })
  }

  const loaded = await loadMilitaryOccupationIndex()
  const role = {
    title: intake.title,
    mustHaves: intake.mustHaves,
    niceToHaves: intake.niceToHaves,
    rawDescription: intake.rawDescription,
  }
  const hypothesis = buildRoleMilitaryHypothesis(loaded.index, role, parsed.data.onetOccupation)
  const drafts = militaryLaneDrafts(hypothesis, role)

  return NextResponse.json({
    ok: true,
    gate: domainGate,
    dataset: loaded.status,
    hypothesis,
    drafts,
    trust: {
      message: 'Military occupation data expands recruiter search hypotheses only. It never satisfies a candidate requirement, verifies a clearance, or produces a candidate fit score.',
    },
  })
}
