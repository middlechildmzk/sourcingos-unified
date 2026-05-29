import { NextRequest, NextResponse } from 'next/server'
import { getJobSubmissions, updateJobSubmissionStatus } from '@/lib/job-board-db'

export async function GET() {
  const submissions = getJobSubmissions()
  return NextResponse.json({
    ok: true,
    pending: submissions.filter(item => item.status === 'pending'),
    approved: submissions.filter(item => item.status === 'approved'),
    rejected: submissions.filter(item => item.status === 'rejected')
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const id = String(body.id || '')
    const status = body.status === 'approved' ? 'approved' : body.status === 'rejected' ? 'rejected' : ''
    if (!id || !status) return NextResponse.json({ ok: false, error: 'id and status are required.' }, { status: 400 })
    const updated = updateJobSubmissionStatus(id, status)
    if (!updated) return NextResponse.json({ ok: false, error: 'Submission not found.' }, { status: 404 })
    return NextResponse.json({ ok: true, submission: updated })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Review update failed' }, { status: 500 })
  }
}
