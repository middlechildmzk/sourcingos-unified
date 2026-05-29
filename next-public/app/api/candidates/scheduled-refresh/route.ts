import { NextResponse } from 'next/server'
import { refreshDueCandidates } from '@/lib/candidate-store'

export async function POST(req: Request) {
  const secret = process.env.SOURCINGOS_REFRESH_SECRET
  if (secret && req.headers.get('x-sourcingos-refresh-secret') !== secret) {
    return NextResponse.json({ ok: false, error: 'Unauthorized refresh request' }, { status: 401 })
  }
  const result = await refreshDueCandidates(10)
  return NextResponse.json({ ok: true, ...result, note: 'Scheduled refresh preview. Wire this route to Vercel Cron, Inngest, Trigger.dev, or a queue worker in production.' })
}
