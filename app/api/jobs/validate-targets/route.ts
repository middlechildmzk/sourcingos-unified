import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { requireSession } from '@/lib/auth-gate'
import { atsTargets } from '@/data/ats-targets'
import { fetchAshbyJobs, fetchGreenhouseJobs, fetchLeverJobs } from '@/lib/jobs-ingestion'

async function validateTarget(target: (typeof atsTargets)[number]) {
  const started = Date.now()
  try {
    let jobs = [] as Awaited<ReturnType<typeof fetchGreenhouseJobs>>
    if (target.ats === 'greenhouse') jobs = await fetchGreenhouseJobs(target)
    if (target.ats === 'lever') jobs = await fetchLeverJobs(target)
    if (target.ats === 'ashby') jobs = await fetchAshbyJobs(target)
    return {
      company: target.company,
      ats: target.ats,
      token: target.token,
      status: jobs.length ? 'valid' : 'empty',
      recruiterJobsFound: jobs.length,
      sampleTitles: jobs.slice(0, 5).map(job => job.title),
      categories: target.categories || [],
      tags: target.tags || [],
      checkedAt: new Date().toISOString(),
      ms: Date.now() - started
    }
  } catch (error) {
    return {
      company: target.company,
      ats: target.ats,
      token: target.token,
      status: 'invalid',
      recruiterJobsFound: 0,
      sampleTitles: [],
      categories: target.categories || [],
      tags: target.tags || [],
      checkedAt: new Date().toISOString(),
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : 'Validation failed'
    }
  }
}

export async function GET() {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(null, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  const limit = 80
  const selected = atsTargets.slice(0, limit)
  const results = [] as Awaited<ReturnType<typeof validateTarget>>[]
  for (let i = 0; i < selected.length; i += 8) {
    const batch = selected.slice(i, i + 8)
    const validated = await Promise.all(batch.map(validateTarget))
    results.push(...validated)
  }
  const validTargets = results.filter(result => result.status === 'valid')
  const recruiterJobsFound = results.reduce((sum, result) => sum + result.recruiterJobsFound, 0)
  return NextResponse.json({
    ok: true,
    checked: results.length,
    validTargets: validTargets.length,
    recruiterJobsFound,
    targetPoolSize: atsTargets.length,
    note: 'Targets are public ATS feed candidates. Jobs only publish when titles pass recruiter/sourcer/TA relevance filters.',
    results
  })
}
