import { NextResponse } from 'next/server'
import { getCandidateDb } from '@/lib/candidate-db-v18'
import { createRefreshPlan } from '@/lib/candidate-intelligence-v18'

export async function GET() {
  const db = getCandidateDb()
  return NextResponse.json({ ok: true, plan: createRefreshPlan(db) })
}
