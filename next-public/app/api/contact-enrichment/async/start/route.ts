import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { startAsyncContactEnrichmentV36_16, publicAsyncContactJobV36_16 } from '@/lib/contact-enrichment/async-enrichment-service-v36-16'
import type { ContactEnrichmentRequest, ContactEnrichmentProvider } from '@/lib/contact-enrichment/types'
import type { ContactResolutionGoalV36_12 } from '@/lib/contact-enrichment/orchestrator-v35'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  goals: z.array(z.enum(['work_email', 'personal_email', 'phone'])).min(1).max(3),
  candidateId: z.string().trim().min(1).max(160).optional(),
  sourceProfileId: z.string().trim().min(1).max(200).optional(),
  providerPersonId: z.string().trim().min(1).max(500).optional(),
  providerName: z.string().trim().min(1).max(80).optional(),
  firstName: z.string().trim().min(1).max(120).optional(),
  lastName: z.string().trim().min(1).max(160).optional(),
  fullName: z.string().trim().min(1).max(260).optional(),
  currentCompany: z.string().trim().min(1).max(260).optional(),
  companyDomain: z.string().trim().min(1).max(260).optional(),
  location: z.string().trim().min(1).max(500).optional(),
  title: z.string().trim().min(1).max(500).optional(),
  profileUrl: z.string().trim().url().max(2000).optional(),
  linkedinUrl: z.string().trim().url().max(2000).optional(),
  githubUrl: z.string().trim().url().max(2000).optional(),
  email: z.string().trim().email().max(320).optional(),
  sourceContext: z.string().trim().min(1).max(120).optional(),
}).strict()

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rlMinute = await rateLimit(req, 'enrichment', gate.userId)
  if (!rlMinute.ok) return rlMinute.response
  const rlDaily = await rateLimit(req, 'enrichmentDaily', gate.userId)
  if (!rlDaily.ok) return rlDaily.response
  if (gate.preview) return NextResponse.json({ ok: false, error: 'Async enrichment requires an authenticated durable workspace.' }, { status: 503 })

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 }) }
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid async enrichment request.', details: parsed.error.flatten() }, { status: 400 })

  const { goals, providerName, ...rest } = parsed.data
  const request: ContactEnrichmentRequest = {
    ...rest,
    ...(providerName ? { providerName: providerName as ContactEnrichmentProvider } : {}),
    sourceContext: rest.sourceContext || 'agentic_sourcing_async_v36_16',
  }

  try {
    const job = await startAsyncContactEnrichmentV36_16({
      ownerId: gate.userId,
      request,
      goals: goals as ContactResolutionGoalV36_12[],
    })
    return NextResponse.json({ ok: true, job: publicAsyncContactJobV36_16(job) }, { status: job.status === 'running' ? 202 : 200 })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Async enrichment could not be started.' }, { status: 502 })
  }
}
