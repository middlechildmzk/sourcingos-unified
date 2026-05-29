import { NextResponse } from 'next/server'
import { queueSnapshot } from '@/lib/candidate-store'

export async function GET() {
  const snapshot = queueSnapshot()
  return NextResponse.json({ ok: true, ...snapshot, generatedAt: new Date().toISOString() })
}
