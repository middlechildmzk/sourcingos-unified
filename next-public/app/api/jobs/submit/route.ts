import { NextRequest, NextResponse } from 'next/server'
import { addJobSubmission, getJobSubmissions } from '@/lib/job-board-db'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'

export async function GET() {
  // Preview only: list submissions from in-memory store.
  // Production: submissions are readable only via admin-gated /api/jobs/review.
  return NextResponse.json({ ok: true, mode: 'preview', submissions: getJobSubmissions() })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = String(body.email || '').trim()
    const companyName = String(body.companyName || '').trim()
    const jobTitle = String(body.jobTitle || '').trim()
    const jobUrl = String(body.jobUrl || '').trim()

    if (!email || !companyName || !jobTitle || !jobUrl) {
      return NextResponse.json(
        { ok: false, error: 'Email, company name, job title, and apply URL are required.' },
        { status: 400 }
      )
    }
    if (!/^https?:\/\//i.test(jobUrl)) {
      return NextResponse.json(
        { ok: false, error: 'Apply URL must start with https://. No fake or placeholder URLs.' },
        { status: 400 }
      )
    }

    const submissionPayload = {
      email,
      companyName,
      jobTitle,
      jobUrl,
      salaryRange: String(body.salaryRange || '').trim(),
      location: String(body.location || '').trim(),
      remoteType: String(body.remoteType || '').trim(),
      notes: String(body.notes || '').trim(),
    }

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
