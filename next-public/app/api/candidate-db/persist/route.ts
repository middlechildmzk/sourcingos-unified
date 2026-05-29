import { NextResponse } from 'next/server'
import { getCandidateDb } from '@/lib/candidate-db-v18'
import { persistCandidateGraphSnapshot, requiredCandidateGraphEnv } from '@/lib/supabase-candidate-graph'

export async function GET() {
  const result = await persistCandidateGraphSnapshot(getCandidateDb())
  return NextResponse.json({ ok: result.ok, result, requiredEnv: requiredCandidateGraphEnv })
}
