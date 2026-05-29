import { NextRequest, NextResponse } from 'next/server'
import { contactsFromText, evidenceFromText, inferOpenToWorkSignals, normalizeWhitespace, splitSkills } from '@/lib/candidate-db-v18'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const text = String(body.text || body.rawText || '')
    const source = body.source || 'manual'
    const normalized = normalizeWhitespace(text)
    if (!normalized) return NextResponse.json({ ok: false, error: 'No candidate text supplied.' }, { status: 400 })
    const evidence = evidenceFromText(normalized, source)
    const contacts = contactsFromText(normalized, source)
    const openToWorkSignals = inferOpenToWorkSignals(normalized, source)
    const skills = splitSkills(normalized)
    return NextResponse.json({
      ok: true,
      normalized: {
        summary: normalized.slice(0, 700),
        skills,
        facts: evidence.map(e => ({ label: e.label, detail: e.detail, confidence: e.confidence })),
        contacts: contacts.map(c => ({ type: c.type, value: c.value, source: c.source, confidence: c.confidence, verified: c.verified, permissionStatus: c.permissionStatus })),
        openToWorkSignals,
        inferences: [
          'Skills are extracted from explicit text matches only.',
          'Open-to-work signals require recruiter review and are not treated as verified job-search status.',
          'Contact signals are unverified by default.'
        ],
        verifyNext: [
          'Confirm current employer and title from a primary source.',
          'Confirm whether public profiles belong to the same person before merging.',
          'Verify contact information through an approved workflow before outreach.',
          'Do not infer protected traits or private job-search intent.'
        ]
      }
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Normalization failed' }, { status: 500 })
  }
}
