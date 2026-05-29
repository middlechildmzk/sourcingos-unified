import { NextResponse } from 'next/server'
import { getCandidateDb } from '@/lib/candidate-db-v18'

export async function GET() {
  const db = getCandidateDb()
  return NextResponse.json({ ok: true, ...db })
}
