import { NextResponse } from 'next/server'
import { z } from 'zod'
import { refreshCandidate } from '@/lib/candidate-store'
import { allSourceNames, SourceName } from '@/lib/source-types'

const sourceEnum = z.enum(allSourceNames as [SourceName, ...SourceName[]])
const schema = z.object({ candidateId: z.string().min(2), sources: z.array(sourceEnum).optional() })

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json())
    const result = await refreshCandidate(body.candidateId, body.sources)
    if (!result) return NextResponse.json({ ok: false, error: 'Candidate not found' }, { status: 404 })
    return NextResponse.json({ ok: true, ...result, note: 'Manual refresh completed through the persistent candidate graph adapter.' })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Candidate refresh failed' }, { status: 400 })
  }
}
