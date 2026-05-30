import { NextRequest, NextResponse } from 'next/server'
import { getJobSubmissions, updateJobSubmissionStatus } from '@/lib/job-board-db'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { requireAdminCookie } from '@/lib/supabase/route-session'

export async function GET(req: NextRequest) {
  // ── Admin check via cookies (fixes 401 for logged-in admins) ──────────────
  const authError = await requireAdminCookie()
  if (authError) {
    return NextResponse.json(authError, { status: authError.status })
  }

  // ── Supabase read when configured ──────────────────────────────────────────
  if (isSupabaseConfigured()) {
    const sb = createServerSupabaseClient()
    if (sb) {
      const { data, error } = await sb
        .from('job_submissions')
        .select('*')
        .order('submitted_at', { ascending: false })
        .limit(200)

      if (error) {
        console.error('[SourcingOS jobs/review] Supabase read error:', error.message)
        // Fall through to in-memory
      } else {
        const submissions = data || []
        return NextResponse.json({
          ok: true,
          mode: 'supabase',
          pending: submissions.filter(s => s.status === 'pending'),
          approved: submissions.filter(s => s.status === 'approved'),
          rejected: submissions.filter(s => s.status === 'rejected'),
        })
      }
    }
  }

  // ── In-memory fallback ─────────────────────────────────────────────────────
  const submissions = getJobSubmissions()
  return NextResponse.json({
    ok: true,
    mode: 'preview',
    _note: 'Preview mode: submissions reset on cold start. Configure Supabase for durable storage.',
    pending: submissions.filter(s => s.status === 'pending'),
    approved: submissions.filter(s => s.status === 'approved'),
    rejected: submissions.filter(s => s.status === 'rejected'),
  })
}

export async function POST(req: NextRequest) {
  // ── Admin check via cookies ────────────────────────────────────────────────
  const authError = await requireAdminCookie()
  if (authError) {
    return NextResponse.json(authError, { status: authError.status })
  }

  try {
    const body = await req.json()
    const id = String(body.id || '').trim()
    const rawStatus = String(body.status || '')
    const status = rawStatus === 'approved' ? 'approved' : rawStatus === 'rejected' ? 'rejected' : ''

    if (!id || !status) {
      return NextResponse.json(
        { ok: false, error: 'id and status (approved|rejected) are required.' },
        { status: 400 }
      )
    }

    // ── Supabase write when configured ────────────────────────────────────
    if (isSupabaseConfigured()) {
      const sb = createServerSupabaseClient()
      if (sb) {
        const { data, error } = await sb
          .from('job_submissions')
          .update({ status, reviewed_at: new Date().toISOString() })
          .eq('id', id)
          .select('id, status, reviewed_at')
          .single()

        if (error) {
          console.error('[SourcingOS jobs/review] Supabase update error:', error.message)
          // Fall through to in-memory
        } else {
          // When approved, also write to approved_jobs
          if (status === 'approved' && data) {
            const sub = await sb
              .from('job_submissions')
              .select('*')
              .eq('id', id)
              .single()
            if (!sub.error && sub.data) {
              await sb.from('approved_jobs').upsert({
                submission_id: id,
                company_name: sub.data.company_name,
                job_title: sub.data.job_title,
                job_url: sub.data.job_url,
                salary_range: sub.data.salary_range,
                location: sub.data.location,
                remote_type: sub.data.remote_type,
                is_active: true,
              }, { onConflict: 'submission_id' })
            }
          }
          return NextResponse.json({ ok: true, mode: 'supabase', submission: data })
        }
      }
    }

    // ── In-memory fallback ──────────────────────────────────────────────────
    const updated = updateJobSubmissionStatus(id, status)
    if (!updated) {
      return NextResponse.json({ ok: false, error: 'Submission not found.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, mode: 'preview', submission: updated })

  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Review update failed' },
      { status: 500 }
    )
  }
}
