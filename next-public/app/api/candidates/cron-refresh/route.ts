import { NextResponse } from 'next/server'
import { refreshDueCandidates } from '@/lib/candidate-store'
import { authorizeCronRequest } from '@/lib/cron-auth'

export async function GET(req: Request) {
  const auth = authorizeCronRequest(req)
  if (auth === 'unavailable') return NextResponse.json({ ok: false, error: 'Not available.' }, { status: 503 })
  if (auth !== 'authorized') return NextResponse.json({ ok: false, error: 'Unauthorized cron refresh' }, { status: 401 })

  const result = await refreshDueCandidates(10)
  return NextResponse.json({ ok: true, mode: 'scheduled-refresh', ...result, ranAt: new Date().toISOString() })
}

// Route: /api/candidates/cron-refresh
