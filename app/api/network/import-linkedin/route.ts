import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'
import { requireSession } from '@/lib/auth-gate'
import { getRouteSession } from '@/lib/supabase/route-session'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getCandidateDb, nowIso, uid } from '@/lib/candidate-db-v18'

// Use an existing public/source enum value for imported LinkedIn network rows.
// The row raw metadata still records importType=linkedin_connections.
// This avoids production DB check/enum failures on unsupported source values like csv_import/linkedin.
const IMPORT_SOURCE = 'resume_xray'

const rowSchema = z.object({
  firstName: z.string().max(100).optional().default(''),
  lastName: z.string().max(100).optional().default(''),
  fullName: z.string().max(200).optional().default(''),
  company: z.string().max(200).optional().default(''),
  position: z.string().max(200).optional().default(''),
  url: z.string().max(500).optional().default(''),
  email: z.string().max(240).optional().default(''),
  connectedOn: z.string().max(80).optional().default(''),
})

const schema = z.object({
  rows: z.array(rowSchema).min(1).max(500),
  importLabel: z.string().max(120).optional().default('LinkedIn connections export'),
})

type ImportRow = z.infer<typeof rowSchema>

function clean(value: unknown): string {
  return String(value || '').trim()
}

function nameFor(row: ImportRow): string {
  return clean(row.fullName) || [row.firstName, row.lastName].map(clean).filter(Boolean).join(' ') || 'LinkedIn connection'
}

function profileIdFor(row: ImportRow): string {
  const stable = clean(row.url) || [nameFor(row), row.company, row.position].map(clean).filter(Boolean).join('|')
  return stable.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120) || uid('linkedin')
}

function skillsFromText(text: string): string[] {
  const hints = ['python', 'react', 'typescript', 'javascript', 'aws', 'azure', 'kubernetes', 'terraform', 'security', 'devops', 'devsecops', 'machine learning', 'ml', 'ai', 'data', 'nursing', 'recruiting', 'sourcing', 'sales', 'marketing', 'founder', 'product']
  const lower = text.toLowerCase()
  return Array.from(new Set(hints.filter(h => lower.includes(h)).map(h => h === 'ml' ? 'ML' : h))).slice(0, 10)
}

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  try {
    const body = schema.parse(await req.json())
    const rows = body.rows
    const session = await getRouteSession()

    if (!isSupabaseConfigured()) {
      const db = getCandidateDb()
      const batchId = uid('batch')
      let created = 0
      const warnings: string[] = []

      for (const row of rows) {
        const displayName = nameFor(row)
        const sourceProfileId = uid('sp')
        const candidateId = uid('cand')
        const raw = JSON.stringify(row)
        const headline = clean(row.position)
        const company = clean(row.company)
        const profileUrl = clean(row.url)
        const skills = skillsFromText(`${headline} ${company}`)

        db.sourceProfiles.unshift({
          id: sourceProfileId,
          source: IMPORT_SOURCE,
          sourceProfileId: profileIdFor(row),
          profileUrl,
          displayName,
          headline,
          location: '',
          organization: company,
          rawText: raw,
          raw: { ...row, importType: 'linkedin_connections', importSource: 'linkedin_export' },
          status: 'pending',
          matchScore: 0,
          matchReasons: ['Imported from user-owned LinkedIn connections export'],
          candidateId,
          lastSeenAt: nowIso(),
          createdAt: nowIso(),
        })

        db.candidates.unshift({
          id: candidateId,
          canonicalName: displayName,
          headline,
          location: '',
          currentCompany: company,
          currentTitle: headline,
          summary: 'Imported from LinkedIn connections export. Relationship signal only; not a job-market or outreach-permission signal.',
          skills,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          sourceProfileIds: [sourceProfileId],
          evidenceItemIds: [],
          contactSignalIds: [],
          openToWorkSignalIds: [],
          mergeStatus: 'pending',
        })
        created++
      }

      db.importBatches.unshift({
        id: batchId,
        importType: 'csv',
        fileName: body.importLabel,
        rowsSeen: rows.length,
        recordsCreated: created,
        warnings,
        createdAt: nowIso(),
      })

      return NextResponse.json({ ok: true, mode: 'preview', batchId, rowsSeen: rows.length, created, warnings, note: 'Preview mode — import stored in memory only.' })
    }

    if (!session.authenticated || !session.userId) {
      return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 })
    }

    const sb = createServerSupabaseClient()
    if (!sb) return NextResponse.json({ ok: false, error: 'Supabase client unavailable.' }, { status: 500 })

    const ownerId = session.userId
    let created = 0
    let skipped = 0
    const warnings: string[] = []

    for (const row of rows) {
      const displayName = nameFor(row)
      const headline = clean(row.position)
      const company = clean(row.company)
      const profileUrl = clean(row.url) || null
      const email = clean(row.email)
      const sourceProfileKey = profileIdFor(row)
      const skills = skillsFromText(`${headline} ${company}`)

      const { data: existingProfile, error: existingError } = await sb
        .from('source_profiles')
        .select('id,candidate_id')
        .eq('owner_id', ownerId)
        .eq('source', IMPORT_SOURCE)
        .eq('source_profile_id', sourceProfileKey)
        .maybeSingle()

      if (existingError) {
        warnings.push(`Lookup failed for ${displayName}: ${existingError.message}`)
        skipped++
        continue
      }

      if (existingProfile?.candidate_id) {
        skipped++
        continue
      }

      const { data: spData, error: spError } = await sb.from('source_profiles').upsert({
        owner_id: ownerId,
        source: IMPORT_SOURCE,
        source_profile_id: sourceProfileKey,
        profile_url: profileUrl,
        display_name: displayName,
        headline: headline || null,
        location: null,
        organization: company || null,
        raw: { ...row, importType: 'linkedin_connections', importSource: 'linkedin_export', importLabel: body.importLabel },
        status: 'pending',
        match_score: 0,
        match_reasons: ['Imported from user-owned LinkedIn connections export'],
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'owner_id,source,source_profile_id' }).select('id').single()

      if (spError || !spData?.id) {
        warnings.push(`source_profiles failed for ${displayName}: ${spError?.message || 'source profile failed'}`)
        skipped++
        continue
      }

      const { data: candData, error: candError } = await sb.from('candidates').insert({
        owner_id: ownerId,
        canonical_name: displayName,
        headline: headline || null,
        location: null,
        current_company: company || null,
        skills,
        summary: 'Imported from LinkedIn connections export. Relationship signal only; not a job-market or outreach-permission signal.',
        merge_status: 'pending',
      }).select('id').single()

      if (candError || !candData?.id) {
        warnings.push(`candidates failed for ${displayName}: ${candError?.message || 'candidate insert failed'}`)
        skipped++
        continue
      }

      const candidateId = candData.id
      const { error: linkError } = await sb.from('source_profiles').update({ candidate_id: candidateId }).eq('id', spData.id)
      if (linkError) warnings.push(`link failed for ${displayName}: ${linkError.message}`)

      const { error: evidenceError } = await sb.from('evidence_items').insert({
        owner_id: ownerId,
        candidate_id: candidateId,
        source_profile_id: spData.id,
        source: IMPORT_SOURCE,
        label: 'LinkedIn connection export row',
        detail: `${displayName}${headline ? ` — ${headline}` : ''}${company ? ` at ${company}` : ''}. Connection import is relationship context only and does not imply job interest or outreach permission.`,
        confidence: 'medium',
        url: profileUrl,
      })
      if (evidenceError) warnings.push(`evidence failed for ${displayName}: ${evidenceError.message}`)

      const contacts = []
      if (email) contacts.push({
        owner_id: ownerId,
        candidate_id: candidateId,
        source_profile_id: spData.id,
        type: 'public_email',
        value: email,
        source: IMPORT_SOURCE,
        confidence: 'medium',
        verified: false,
        permission_status: 'unknown',
      })
      if (profileUrl) contacts.push({
        owner_id: ownerId,
        candidate_id: candidateId,
        source_profile_id: spData.id,
        type: 'profile_url',
        value: profileUrl,
        source: IMPORT_SOURCE,
        confidence: 'medium',
        verified: false,
        permission_status: 'unknown',
      })
      if (contacts.length) {
        const { error: contactError } = await sb.from('candidate_contacts').insert(contacts)
        if (contactError) warnings.push(`contacts failed for ${displayName}: ${contactError.message}`)
      }

      created++
    }

    if (created === 0 && warnings.length > 0) {
      return NextResponse.json({ ok: false, mode: 'supabase', rowsSeen: rows.length, created, skipped, warnings, error: warnings[0] }, { status: 500 })
    }

    return NextResponse.json({ ok: true, mode: 'supabase', rowsSeen: rows.length, created, skipped, warnings, note: 'Imported as pending private records. Review before outreach.' })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Import failed.' }, { status: 400 })
  }
}
