import { NextResponse } from 'next/server'
import { refreshDueCandidates } from '@/lib/candidate-store'
export async function GET(req: Request) { const secret = process.env.CRON_SECRET; if (!secret) { return NextResponse.json({ ok: false, error: 'Not available.' }, { status: 503 }) } { const supplied = new URL(req.url).searchParams.get('secret') || req.headers.get('x-cron-secret'); if (supplied !== secret) return NextResponse.json({ ok: false, error: 'Unauthorized cron refresh' }, { status: 401 }) } const result = await refreshDueCandidates(10); return NextResponse.json({ ok: true, mode: 'scheduled-refresh', ...result, ranAt: new Date().toISOString() }) }
// Route: /api/candidates/cron-refresh
