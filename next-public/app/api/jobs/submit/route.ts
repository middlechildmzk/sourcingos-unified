import { NextRequest, NextResponse } from 'next/server'
import { addJobSubmission, getJobSubmissions } from '@/lib/job-board-db'

export async function GET() {
  return NextResponse.json({ ok: true, submissions: getJobSubmissions() })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = String(body.email || '').trim()
    const companyName = String(body.companyName || '').trim()
    const jobTitle = String(body.jobTitle || '').trim()
    const jobUrl = String(body.jobUrl || '').trim()
    if (!email || !companyName || !jobTitle || !jobUrl) {
      return NextResponse.json({ ok: false, error: 'Email, company, job title, and apply URL are required.' }, { status: 400 })
    }
    if (!/^https?:\/\//i.test(jobUrl)) {
      return NextResponse.json({ ok: false, error: 'Apply URL must start with http or https.' }, { status: 400 })
    }
    const submission = addJobSubmission({
      email,
      companyName,
      jobTitle,
      jobUrl,
      salaryRange: String(body.salaryRange || '').trim(),
      location: String(body.location || '').trim(),
      remoteType: String(body.remoteType || '').trim(),
      notes: String(body.notes || '').trim()
    })
    return NextResponse.json({ ok: true, submission })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Submission failed' }, { status: 500 })
  }
}
