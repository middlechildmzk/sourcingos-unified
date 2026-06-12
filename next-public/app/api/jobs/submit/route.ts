import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { addJobSubmission, getJobSubmissions } from '@/lib/job-board-db'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { parseBody } from '@/lib/validate'

const submitSchema = z.object({
  email: z.string().email().max(200),
  companyName: z.string().min(1).max(200),
  jobTitle: z.string().min(1).max(200),
  jobUrl: z.string().url().max(500).regex(/^https?:\/\//i),
  salaryRange: z.string().max(120).optional().default(''),
  location: z.string().max(200).optional().default(''),
  remoteType: z.string().max(60).optional().default(''),
  notes: z.string().max(2000).optional().default(''),
}).strip()

export async function GET() {
  // Security sprint: submissions contain submitter emails — admin only.
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response
  return NextResponse.json({ ok: true, mode: 'preview', submissions: getJobSubmissions() })
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, 'submit')
  if (!rl.ok) return rl.response

  const parsed = await parseBody(req, submitSchema, 8 * 1024)
  if (!parsed.ok) return parsed.response

  try {
    const { email, companyName, jobTitle, jobUrl } = parsed.data
    const submissionPayload = { ...parsed.data }

    // ── Supabase persistence when configured ────────────────────────────────
    if (isSupabaseConfigured()) {
      const sb = createServerSupabaseClient()
      if (sb) {
        const { data, error } = await sb.from('job_submissions').insert({
          email,
          company_name: companyName,
          job_title: jobTitle,
          job_url: jobUrl,
          salary_range: submissionPayload.salaryRange || null,
          location: submissionPayload.location || null,
          remote_type: submissionPayload.remoteType || null,
          notes: submissionPayload.notes || null,
          status: 'pending',
        }).select('id, status, submitted_at').single()

        if (error) {
          console.error('[SourcingOS jobs/submit] Supabase write error:', error.message)
          // Fall through to in-memory
        } else {
          return NextResponse.json({ ok: true, mode: 'supabase', submission: data })
        }
      }
    }

    // ── In-memory fallback ──────────────────────────────────────────────────
    const submission = addJobSubmission(submissionPayload)
    return NextResponse.json({ ok: true, mode: 'preview', submission })

  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Submission failed' },
      { status: 500 }
    )
  }
}
