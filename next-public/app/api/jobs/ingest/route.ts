import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { atsTargets } from '@/data/ats-targets'
import { requireAdmin } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { parseBody } from '@/lib/validate'
import { fetchAshbyJobs, fetchGreenhouseJobs, fetchLeverJobs, type NormalizedJob } from '@/lib/jobs-ingestion'
import { persistNormalizedJobs } from '@/lib/jobs-v2'

export const dynamic = 'force-dynamic'

const ingestSchema = z.object({
  source: z.enum(['ats']).optional().default('ats'),
  limitTargets: z.number().int().min(1).max(100).optional().default(50),
}).strip()

async function fetchAtsBatch(limitTargets: number): Promise<NormalizedJob[]> {
  const targets = atsTargets.slice(0, limitTargets)
  const groups = await Promise.all(targets.map(target => {
    if (target.ats === 'greenhouse') return fetchGreenhouseJobs(target)
    if (target.ats === 'lever') return fetchLeverJobs(target)
    return fetchAshbyJobs(target)
  }))
  return groups.flat()
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  const body = await parseBody(req, ingestSchema, 4 * 1024)
  if (!body.ok) return body.response

  const startedAt = new Date().toISOString()
  const jobs = body.data.source === 'ats' ? await fetchAtsBatch(body.data.limitTargets) : []
  const result = await persistNormalizedJobs(jobs)

  return NextResponse.json({
    ok: true,
    source: body.data.source,
    startedAt,
    finishedAt: new Date().toISOString(),
    fetched: jobs.length,
    persistence: result,
    notes: [
      'Ingest stores recruiter/TA-relevant metadata and snippets only.',
      'Apply URLs remain pointed at the original source.',
      'Submissions and low-confidence roles still require review before being treated as curated listings.'
    ]
  })
}
