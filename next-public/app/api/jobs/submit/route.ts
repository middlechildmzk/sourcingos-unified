import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { addJobSubmission, getJobSubmissions, updateJobSubmissionStatus } from '@/lib/job-board-db'
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

const reviewSchema = z.object({
  id: z.string().min(1).max(120),
  status: z.enum(['approved', 'rejected']),
}).strip()

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  if (isSupabaseConfigured()) {
    const sb = createServerSupabaseClient()
    if (sb) {
      const { data, error } = await sb.from('job_submissions')
        .select('id, employer_name, contact_email, title, company, apply_url, salary_text, location, description, status, reviewed_by, reviewed_at, created_at, email, company_name, job_title, job_url, salary_range, remote_type, notes, submitted_at')
        .order('created_at', { ascending: false })
        .limit(100)
      if (!error) return NextResponse.json({ ok: true, mode: 'supabase', submissions: data || [] })
    }
  }

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

    if (isSupabaseConfigured()) {
      const sb = createServerSupabaseClient()
      if (sb) {
        const now = new Date().toISOString()
        const { data, error } = await sb.from('job_submissions').insert({
          employer_name: companyName,
          contact_email: email,
          title: jobTitle,
          company: companyName,
          apply_url: jobUrl,
          salary_text: submissionPayload.salaryRange || null,
          location: submissionPayload.location || null,
          description: submissionPayload.notes || null,
          status: 'pending',
          created_at: now,
          updated_at: now,
          email,
          company_name: companyName,
          job_title: jobTitle,
          job_url: jobUrl,
          salary_range: submissionPayload.salaryRange || null,
          remote_type: submissionPayload.remoteType || null,
          notes: submissionPayload.notes || null,
          submitted_at: now,
        }).select('id, status, submitted_at, created_at').single()

        if (error) {
          console.error('[SourcingOS jobs/submit] Supabase write error:', error.message)
        } else {
          return NextResponse.json({ ok: true, mode: 'supabase', submission: data })
        }
      }
    }

    const submission = addJobSubmission(submissionPayload)
    return NextResponse.json({ ok: true, mode: 'preview', submission })

  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Submission failed' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  const parsed = await parseBody(req, reviewSchema, 4 * 1024)
  if (!parsed.ok) return parsed.response

  if (isSupabaseConfigured()) {
    const sb = createServerSupabaseClient()
    if (sb) {
      const { data, error } = await sb.from('job_submissions').update({
        status: parsed.data.status,
        reviewed_by: gate.userId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', parsed.data.id).select('id, status, reviewed_at').single()
      if (!error) return NextResponse.json({ ok: true, mode: 'supabase', submission: data })
    }
  }

  const item = updateJobSubmissionStatus(parsed.data.id, parsed.data.status)
  if (!item) return NextResponse.json({ ok: false, error: 'Submission not found.' }, { status: 404 })
  return NextResponse.json({ ok: true, mode: 'preview', submission: item })
}
