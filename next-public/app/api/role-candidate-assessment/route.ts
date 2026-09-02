import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { getCandidateDb, type CandidateDbSnapshot } from '@/lib/candidate-db-v18'
import { fuseCandidateIdentityV34 } from '@/lib/candidate-identity-fusion-v34'
import { resolveCandidate360FieldsV35 } from '@/lib/candidate-field-resolution-v35'
import { buildEvidenceLedger } from '@/lib/evidence-ledger'
import { buildRequirementAssessments, requirementAssessmentTally } from '@/lib/requirement-assessment-v32'
import { buildRoleCandidateIntelligenceV35 } from '@/lib/entity-intelligence/role-candidate-intelligence-v35'
import { normalizeRoleSearchIntelligenceV35 } from '@/lib/entity-intelligence/search-approval-v35'
import type { RoleCandidate, RoleIntake } from '@/lib/role-workspace'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type CandidateInput = Pick<RoleCandidate, 'candidateId' | 'name' | 'headline' | 'company' | 'location' | 'fitReasons' | 'concerns' | 'tags' | 'contactStatus' | 'evidenceStatus'>

type RequestBody = {
  intake?: RoleIntake
  candidates?: CandidateInput[]
  searchIntelligence?: unknown
}

function compactText(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function textArray(value: unknown, max = 50): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(item => compactText(item, 300)).filter(Boolean))).slice(0, max)
}

function sameText(a: unknown, b: unknown): boolean {
  return compactText(a, 1000).toLowerCase() === compactText(b, 1000).toLowerCase()
}

function validIntake(value: unknown): RoleIntake | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  return {
    title: compactText(input.title, 300) || 'Untitled role',
    location: compactText(input.location, 300) || 'Not specified',
    workMode: ['remote', 'hybrid', 'onsite', 'flexible', 'unknown'].includes(String(input.workMode)) ? input.workMode as RoleIntake['workMode'] : 'unknown',
    compensation: compactText(input.compensation, 300) || 'Not specified',
    clearance: compactText(input.clearance, 300) || 'Not specified',
    mustHaves: textArray(input.mustHaves),
    niceToHaves: textArray(input.niceToHaves),
    disqualifiers: textArray(input.disqualifiers),
    targetCompanies: textArray(input.targetCompanies),
    adjacentBackgrounds: textArray(input.adjacentBackgrounds),
    hiringManagerNotes: compactText(input.hiringManagerNotes, 3000),
    rawDescription: compactText(input.rawDescription, 12000),
  }
}

function validCandidate(value: unknown): CandidateInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  const candidateId = compactText(input.candidateId, 200)
  const name = compactText(input.name, 300)
  if (!candidateId || !name) return null
  const contactStatus = ['unknown', 'signals_found', 'verified', 'blocked'].includes(String(input.contactStatus))
    ? input.contactStatus as RoleCandidate['contactStatus']
    : 'unknown'
  const evidenceStatus = ['unreviewed', 'reviewed', 'conflicting', 'stale'].includes(String(input.evidenceStatus))
    ? input.evidenceStatus as RoleCandidate['evidenceStatus']
    : 'unreviewed'
  return {
    candidateId,
    name,
    headline: compactText(input.headline, 500),
    company: compactText(input.company, 300),
    location: compactText(input.location, 300),
    fitReasons: textArray(input.fitReasons, 20),
    concerns: textArray(input.concerns, 20),
    tags: textArray(input.tags, 20),
    contactStatus,
    evidenceStatus,
  }
}

function subsetPreview(snapshot: CandidateDbSnapshot, ids: Set<string>): CandidateDbSnapshot {
  const profiles = snapshot.sourceProfiles.filter(profile => profile.candidateId && ids.has(profile.candidateId))
  const profileIds = new Set(profiles.map(profile => profile.id))
  return {
    candidates: snapshot.candidates.filter(candidate => ids.has(candidate.id)),
    sourceProfiles: profiles,
    evidenceItems: snapshot.evidenceItems.filter(item => (item.candidateId && ids.has(item.candidateId)) || (item.sourceProfileId && profileIds.has(item.sourceProfileId))),
    contactSignals: snapshot.contactSignals.filter(item => (item.candidateId && ids.has(item.candidateId)) || (item.sourceProfileId && profileIds.has(item.sourceProfileId))),
    openToWorkSignals: snapshot.openToWorkSignals.filter(item => (item.candidateId && ids.has(item.candidateId)) || (item.sourceProfileId && profileIds.has(item.sourceProfileId))),
    matchReviews: snapshot.matchReviews.filter(review => (review.candidateId && ids.has(review.candidateId)) || review.sourceProfileIds.some(id => profileIds.has(id))),
    importBatches: [],
  }
}

async function supabaseSnapshot(ownerId: string, ids: string[]): Promise<CandidateDbSnapshot> {
  const sb = createServerSupabaseClient()
  if (!sb) throw new Error('Supabase client unavailable.')

  const [candidateRes, profileRes, evidenceRes, contactRes, availabilityRes, reviewRes] = await Promise.all([
    sb.from('candidates').select('*').eq('owner_id', ownerId).in('id', ids),
    sb.from('source_profiles').select('*').eq('owner_id', ownerId).in('candidate_id', ids),
    sb.from('evidence_items').select('*').eq('owner_id', ownerId).in('candidate_id', ids),
    sb.from('candidate_contacts').select('*').eq('owner_id', ownerId).in('candidate_id', ids),
    sb.from('open_to_work_signals').select('*').eq('owner_id', ownerId).in('candidate_id', ids),
    sb.from('identity_match_reviews').select('*').eq('owner_id', ownerId).in('candidate_id', ids),
  ])

  const error = candidateRes.error || profileRes.error || evidenceRes.error || contactRes.error || availabilityRes.error || reviewRes.error
  if (error) throw error

  return {
    candidates: (candidateRes.data || []).map((candidate: any) => ({
      id: candidate.id,
      canonicalName: candidate.canonical_name,
      headline: candidate.headline || '',
      location: candidate.location || undefined,
      currentCompany: candidate.current_company || undefined,
      currentTitle: candidate.current_title || undefined,
      summary: candidate.summary || '',
      skills: Array.isArray(candidate.skills) ? candidate.skills : [],
      createdAt: candidate.created_at,
      updatedAt: candidate.updated_at,
      lastRefreshedAt: candidate.last_refreshed_at || undefined,
      sourceProfileIds: [], evidenceItemIds: [], contactSignalIds: [], openToWorkSignalIds: [],
      mergeStatus: candidate.merge_status || 'pending',
    })),
    sourceProfiles: (profileRes.data || []).map((profile: any) => ({
      id: profile.id,
      candidateId: profile.candidate_id || undefined,
      source: profile.source,
      sourceProfileId: profile.source_profile_id,
      profileUrl: profile.profile_url || undefined,
      displayName: profile.display_name,
      headline: profile.headline || undefined,
      location: profile.location || undefined,
      organization: profile.organization || undefined,
      rawText: profile.raw_text || undefined,
      raw: profile.raw,
      status: profile.status || 'pending',
      matchScore: profile.match_score || 0,
      matchReasons: Array.isArray(profile.match_reasons) ? profile.match_reasons : [],
     ²È="25}¹…µ”ñð€%‘•¹Ñ¥ÑäÉ•Ù¥•Üœ°(€€€€€Í½É”èÉ•Ù¥•Ü¹µ…Ñ¡}Í½É”ñð€À°(€€€€€É•…Í½¹ÌèÉÉ…ä¹¥ÍÉÉ…ä¡É•Ù¥•Ü¹µ…Ñ¡}É•…Í½¹Ì¤€üÉ•Ù¥•Ü¹µ…Ñ¡}É•…Í½¹Ì€èmt°(€€€€€½¹™±¥ÑÌèÉÉ…ä¹¥ÍÉÉ…ä¡É•Ù¥•Ü¹½¹™±¥ÑÌ¤€üÉ•Ù¥•Ü¹½¹™±¥ÑÌ€èmt°(€€€€€‘•¥Í¥½¸èÉ•Ù¥•Ü¹‘•¥Í¥½¸ñð€Á•¹‘¥¹œœ°(€€€€€‘•¥‘•‘	äèÉ•Ù¥•Ü¹‘•¥‘•‘}‰äñðÕ¹‘•™¥¹•°(€€€€€‘•¥‘•‘ÐèÉ•Ù¥•Ü¹‘•¥‘•‘}…ÐñðÕ¹‘•™¥¹•°(€€€€€É•…Ñ•‘ÐèÉ•Ù¥•Ü¹É•…Ñ•‘}…Ð°(€€€ô¤¤°(€€€¥µÁ½ÉÑ	…Ñ¡•Ìèmt°(€ô)ô()™Õ¹Ñ¥½¸É½±•…¹‘¥‘…Ñ•½¹Ñ•áÐ¡…¹‘¥‘…Ñ”è…¹‘¥‘…Ñ•%¹ÁÕÐ¤èI½±•…¹‘¥‘…Ñ”ì(€½¹ÍÐ¹½Ü€ô¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤(€É•ÑÕÉ¸ì(€€€¥è…¹‘¥‘…Ñ”¹…¹‘¥‘…Ñ•%„°(€€€…¹‘¥‘…Ñ•%è…¹‘¥‘…Ñ”¹…¹‘¥‘…Ñ•%°(€€€¹…µ”è…¹‘¥‘…Ñ”¹¹…µ”°(€€€¡•…‘±¥¹”è…¹‘¥‘…Ñ”¹¡•…‘±¥¹”ñð€œœ°(€€€½µÁ…¹äè…¹‘¥‘…Ñ”¹½µÁ…¹äñð€œœ°(€€€±½…Ñ¥½¸è…¹‘¥‘…Ñ”¹±½…Ñ¥½¸ñð€œœ°(€€€Í½ÕÉ”è€…¹‘¥‘…Ñ•}‘…Ñ…‰…Í”œ°(€€€ÍÑ…”è€¹••‘Í}É•Ù¥•Üœ°(€€€™¥Ñ•¥Í¥½¸è€Õ¹É•Ù¥•Ý•œ°(€€€™¥ÑI•…Í½¹Ìè…¹‘¥‘…Ñ”¹™¥ÑI•…Í½¹Ìñðmt°(€€€½¹•É¹Ìè…¹‘¥‘…Ñ”¹½¹•É¹Ìñðmt°(€€€Ñ…Ìè…¹‘¥‘…Ñ”¹Ñ…Ìñðmt°(€€€½¹Ñ…ÑMÑ…ÑÕÌè…¹‘¥‘…Ñ”¹½¹Ñ…ÑMÑ…ÑÕÌñð€Õ¹­¹½Ý¸œ°(€€€•Ù¥‘•¹•MÑ…ÑÕÌè…¹‘¥‘…Ñ”¹•Ù¥‘•¹•MÑ…ÑÕÌñð€Õ¹É•Ù¥•Ý•œ°(€€€…‘‘•‘Ðè¹½Ü°(€€€ÕÁ‘…Ñ•‘Ðè¹½Ü°(€ô)ô()•áÁ½ÉÐ…Íå¹Œ™Õ¹Ñ¥½¸A=MP¡É•Äè9•áÑI•ÅÕ•ÍÐ¤ì(€½¹ÍÐ…Ñ”€ô…Ý…¥ÐÉ•ÅÕ¥É•M•ÍÍ¥½¸ ¤(€¥˜€ ……Ñ”¹½¬¤É•ÑÕÉ¸…Ñ”¹É•ÍÁ½¹Í”(€½¹ÍÐÉ°€ô…Ý…¥ÐÉ…Ñ•1¥µ¥Ð¡É•Ä°€Ý½É­‰•¹ œ°…Ñ”¹ÕÍ•É%¤(€¥˜€ …É°¹½¬¤É•ÑÕÉ¸É°¹É•ÍÁ½¹Í”((€±•Ð‰½‘äèI•ÅÕ•ÍÑ	½‘ä(€ÑÉäì(€€€‰½‘ä€ô…Ý…¥ÐÉ•Ä¹©Í½¸ ¤(€ô…Ñ ì(€€€É•ÑÕÉ¸9•áÑI•ÍÁ½¹Í”¹©Í½¸¡ì½¬è™…±Í”°•ÉÉ½Èè€%¹Ù…±¥)M=8‰½‘ä¸œô°ìÍÑ…ÑÕÌè€ÐÀÀô¤(€ô((€½¹ÍÐ¥¹Ñ…­”€ôÙ…±¥‘%¹Ñ…­”¡‰½‘ä¹¥¹Ñ…­”¤(€½¹ÍÐÍ•…É¡%¹Ñ•±±¥•¹”€ô¹½Éµ…±¥é•I½±•M•…É¡%¹Ñ•±±¥•¹•XÌÔ¡‰½‘ä¹Í•…É¡%¹Ñ•±±¥•¹”¤(€½¹ÍÐ…¹‘¥‘…Ñ•Ì€ô€¡ÉÉ…ä¹¥ÍÉÉ…ä¡‰½‘ä¹…¹‘¥‘…Ñ•Ì¤€ü‰½‘ä¹…¹‘¥‘…Ñ•Ì€èmt¤¹µ…À¡Ù…±¥‘…¹‘¥‘…Ñ”¤¹™¥±Ñ•È ¡…¹‘¥‘…Ñ”¤è…¹‘¥‘…Ñ”¥Ì…¹‘¥‘…Ñ•%¹ÁÕÐ€ôø	½½±•…¸¡…¹‘¥‘…Ñ”¤¤¹Í±¥” À°€ÔÀ¤(€¥˜€ …¥¹Ñ…­”¤É•ÑÕÉ¸9•áÑI•ÍÁ½¹Í”¹©Í½¸¡ì½¬è™…±Í”°•ÉÉ½Èè€Ù…±¥É½±”¥¹Ñ…­”¥ÌÉ•ÅÕ¥É•¸œô°ìÍÑ…ÑÕÌè€ÐÀÀô¤(€¥˜€ ……¹‘¥‘…Ñ•Ì¹±•¹Ñ ¤É•ÑÕÉ¸9•áÑI•ÍÁ½¹Í”¹©Í½¸¡ì½¬èÑÉÕ”°…¹‘¥‘…Ñ•Ìèmt°µ½‘”è¥ÍMÕÁ…‰…Í•½¹™¥ÕÉ• ¤€ü€ÍÕÁ…‰…Í”œ€è€ÁÉ•Ù¥•Üœô¤((€½¹ÍÐ¥‘Ì€ôÉÉ…ä¹™É½´¡¹•ÜM•Ð¡…¹‘¥‘…Ñ•Ì¹µ…À¡…¹‘¥‘…Ñ”€ôø…¹‘¥‘…Ñ”¹…¹‘¥‘…Ñ•%„¤¹™¥±Ñ•È¡	½½±•…¸¤¤¤(€ÑÉäì(€€€½¹ÍÐÍ¹…ÁÍ¡½Ð€ô¥ÍMÕÁ…‰…Í•½¹™¥ÕÉ• ¤(€€€€€€ü…Ý…¥ÐÍÕÁ…‰…Í•M¹…ÁÍ¡½Ð¡…Ñ”¹ÕÍ•É%°¥‘Ì¤(€€€€€€èÍÕ‰Í•ÑAÉ•Ù¥•Ü¡•Ñ…¹‘¥‘…Ñ•ˆ ¤°¹•ÜM•Ð¡¥‘Ì¤¤(€€€½¹ÍÐ±•‘•È€ô‰Õ¥±‘Ù¥‘•¹•1•‘•È¡Í¹…ÁÍ¡½Ð¤(€€€½¹ÍÐÉ…Á¡…¹‘¥‘…Ñ•Ì€ô¹•Ü5…À¡Í¹…ÁÍ¡½Ð¹…¹‘¥‘…Ñ•Ì¹µ…À¡…¹‘¥‘…Ñ”€ôøm…¹‘¥‘…Ñ”¹¥°…¹‘¥‘…Ñ•t¤¤((€€€½¹ÍÐ…ÍÍ•ÍÍµ•¹ÑÌ€ô…¹‘¥‘…Ñ•Ì¹µ…À¡…¹‘¥‘…Ñ”€ôøì(€€€€€½¹ÍÐ…¹‘¥‘…Ñ•%€ô…¹‘¥‘…Ñ”¹…¹‘¥‘…Ñ•%„(€€€€€½¹ÍÐ±…¥µÌ€ô±•‘•È¹±…¥µÌ¹™¥±Ñ•È¡±…¥´€ôø±…¥´¹…¹‘¥‘…Ñ•%€ôôô…¹‘¥‘…Ñ•%¤(€€€€€½¹ÍÐ…¹‘¥‘…Ñ•½¹Ñ•áÐ€ôÉ½±•…¹‘¥‘…Ñ•½¹Ñ•áÐ¡…¹‘¥‘…Ñ”¤(€€€€€½¹ÍÐÉ•ÅÕ¥É•µ•¹ÑÌ€ô‰Õ¥±‘I•ÅÕ¥É•µ•¹ÑÍÍ•ÍÍµ•¹ÑÌ¡¥¹Ñ…­”°±…¥µÌ°…¹‘¥‘…Ñ•½¹Ñ•áÐ¤(€€€€€½¹ÍÐÑ…±±ä€ôÉ•ÅÕ¥É•µ•¹ÑÍÍ•ÍÍµ•¹ÑQ…±±ä¡É•ÅÕ¥É•µ•¹ÑÌ¤(€€€€€½¹ÍÐµÕÍÑ!…Ù•Ì€ôÉ•ÅÕ¥É•µ•¹ÑÌ¹™¥±Ñ•È¡É•ÅÕ¥É•µ•¹Ð€ôøÉ•ÅÕ¥É•µ•¹Ð¹Ñ¥•È€ôôô€µÕÍÑ}¡…Ù”œ¤(€€€€€½¹ÍÐµÕÍÑ!…Ù•Q…±±ä€ôÉ•ÅÕ¥É•µ•¹ÑÍÍ•ÍÍµ•¹ÑQ…±±ä¡µÕÍÑ!…Ù•Ì¤(€€€€€½¹ÍÐÉ…Á¡…¹‘¥‘…Ñ”€ôÉ…Á¡…¹‘¥‘…Ñ•Ì¹•Ð¡…¹‘¥‘…Ñ•%¤(€€€€€½¹ÍÐÉ•Í½±Ù•‘AÉ½™¥±”€ôÉ•Í½±Ù•…¹‘¥‘…Ñ”ÌØÁ¥•±‘ÍXÌÔ¡Í¹…ÁÍ¡½Ð°±•‘•È°…¹‘¥‘…Ñ•%¤(€€€€€½¹ÍÐÍÑ…Ñ”€ôµÕÍÑ!…Ù•Q…±±ä¹½¹ÑÉ…‘¥Ñ•€ø€À(€€€€€€€€ü€½¹™±¥Ñ¥¹œœ(€€€€€€€€èµÕÍÑ!…Ù•Q…±±ä¹¹••‘ÍY•É¥™¥…Ñ¥½¸€ø€À(€€€€€€€€€€ü€¹••‘Í}Ù•É¥™¥…Ñ¥½¸œ(€€€€€€€€€€èµÕÍÑ!…Ù•Q…±±ä¹Õ¹­¹½Ý¸€ø€À(€€€€€€€€€€€€ü€¥¹ÍÕ™™¥¥•¹Ñ}•Ù¥‘•¹”œ(€€€€€€€€€€€€èµÕÍÑ!…Ù•Q…±±ä¹Ñ½Ñ…°€ø€À(€€€€€€€€€€€€€€ü€•Ù¥‘•¹•}É•…‘äœ(€€€€€€€€€€€€€€è€¹½}É•ÅÕ¥É•µ•¹ÑÌœ(€€€€€½¹ÍÐµ…Ñ¡áÁ±…¹…Ñ¥½¸€ô‰Õ¥±‘I½±•…¹‘¥‘…Ñ•%¹Ñ•±±¥•¹•XÌÔ (€€€€€€€¥¹Ñ…­”°(€€€€€€€…¹‘¥‘…Ñ•½¹Ñ•áÐ°(€€€€€€€É•ÅÕ¥É•µ•¹ÑÌ°(€€€€€€€±…¥µÌ°(€€€€€€€Í•…É¡%¹Ñ•±±¥•¹”°(€€€€€€¤((€€€€€É•ÑÕÉ¸ì(€€€€€€€…¹‘¥‘…Ñ•%°(€€€€€€€…¹½¹¥…±9…µ”èÉ…Á¡…¹‘¥‘…Ñ”ü¹…¹½¹¥…±9…µ”ñð…¹‘¥‘…Ñ”¹¹…µ”°(€€€€€€€¡•…‘±¥¹”èÉ…Á¡…¹‘¥‘…Ñ”ü¹¡•…‘±¥¹”ñð…¹‘¥‘…Ñ”¹¡•…‘±¥¹”ñð€œœ°(€€€€€€€ÍÑ…Ñ”°(€€€€€€€Ñ…±±ä°(€€€€€€€µÕÍÑ!…Ù•Q…±±ä°(€€€€€€€±…¥µ½Õ¹Ðè±…¥µÌ¹±•¹Ñ °(€€€€€€€ÁÕ‰±¥%‘•¹Ñ¥Ñäè™ÕÍ•…¹‘¥‘…Ñ•%‘•¹Ñ¥ÑåXÌÐ¡Í¹…ÁÍ¡½Ð°…¹‘¥‘…Ñ•%¤°(€€€€€€€€¼¼XÌÔ¸ÌÉ½±”µÍÁ•¥™¥Œ•áÁ±…¹…Ñ¥½¸èÍÕÁÁ½ÉÑ•€¼µ¥ÍÍ¥¹œ€¼Ù•É¥™¥…Ñ¥½¸µ…Ñ•€¼(€€€€€€€€¼¼½¹ÑÉ…‘¥Ñ•€¼Í•…É µ½¹±ä¸I½±”µÍ½Á•°¹•Ù•È„…¹‘¥‘…Ñ”™…Ð¸(€€€€€€€µ…Ñ¡áÁ±…¹…Ñ¥½¸°(€€€€€€€€¼¼XÌÔÍ¡…‘½ÜÁÉ½©•Ñ¥½¸¸á¥ÍÑ¥¹œÍ…±…È™¥•±‘ÌÉ•µ…¥¸½µÁ…Ñ¥‰¥±¥Ñä½ÕÑÁÕÐì(€€€€€€€€¼¼¹¼…¹‘¥‘…Ñ”É…Á É½Ü½È…¹½¹¥…°Í…±…È¥ÌµÕÑ…Ñ•‰äÑ¡¥ÌÉ•Í½±Ù•È¸(€€€€€€€É•Í½±Ù•‘AÉ½™¥±”°(€€€€€€€ÁÉ½™¥±•I•Í½±ÕÑ¥½¹M¡…‘½Üèì(€€€€€€€€€±•…åYÍI•Í½±Ù•èì(€€€€€€€€€€€¹…µ•¡…¹•è	½½±•…¸¡É•Í½±Ù•‘AÉ½™¥±”¹¹…µ”¹Ù…±Õ”€˜˜€…Í…µ•Q•áÐ¡É…Á¡…¹‘¥‘…Ñ”ü¹…¹½¹¥…±9…µ”ñð…¹‘¥‘…Ñ”¹¹…µ”°É•Í½±Ù•‘AÉ½™¥±”¹¹…µ”¹Ù…±Õ”¤¤°(€€€€€€€€€€€¡•…‘±¥¹•¡…¹•è	½½±•…¸¡É•Í½±Ù•‘AÉ½™¥±”¹¡•…‘±¥¹”¹Ù…±Õ”€˜˜€…Í…µ•Q•áÐ¡É…Á¡…¹‘¥‘…Ñ”ü¹¡•…‘±¥¹”ñð…¹‘¥‘…Ñ”¹¡•…‘±¥¹”°É•Í½±Ù•‘AÉ½™¥±”¹¡•…‘±¥¹”¹Ù…±Õ”¤¤°(€€€€€€€€€€€½µÁ…¹å¡…¹•è	½½±•…¸¡É•Í½±Ù•‘AÉ½™¥±”¹ÕÉÉ•¹Ñ½µÁ…¹ä¹Ù…±Õ”€˜˜€…Í…µ•Q•áÐ¡É…Á¡…¹‘¥‘…Ñ”ü¹ÕÉÉ•¹Ñ½µÁ…¹äñð…¹‘¥‘…Ñ”¹½µÁ…¹ä°É•Í½±Ù•‘AÉ½™¥±”¹ÕÉÉ•¹Ñ½µÁ…¹ä¹Ù…±Õ”¤¤°(€€€€€€€€€€€Ñ¥Ñ±•¡…¹•è	½½±•…¸¡É•Í½±Ù•‘AÉ½™¥±”¹ÕÉÉ•¹ÑQ¥Ñ±”¹Ù…±Õ”€˜˜€…Í…µ•Q•áÐ¡É…Á¡…¹‘¥‘…Ñ”ü¹ÕÉÉ•¹ÑQ¥Ñ±”ñð…¹‘¥‘…Ñ”¹¡•…‘±¥¹”°É•Í½±Ù•‘AÉ½™¥±”¹ÕÉÉ•¹ÑQ¥Ñ±”¹Ù…±Õ”¤¤°(€€€€€€€€€€€±½…Ñ¥½¹¡…¹•è	½½±•…¸¡É•Í½±Ù•‘AÉ½™¥±”¹±½…Ñ¥½¸¹Ù…±Õ”€˜˜€…Í…µ•Q•áÐ¡É…Á¡…¹‘¥‘…Ñ”ü¹±½…Ñ¥½¸ñð…¹‘¥‘…Ñ”¹±½…Ñ¥½¸°É•Í½±Ù•‘AÉ½™¥±”¹±½…Ñ¥½¸¹Ù…±Õ”¤¤°(€€€€€€€€€ô°(€€€€€€€€€½¹™±¥Ñ½Õ¹ÐèÉ•Í½±Ù•‘AÉ½™¥±”¹½¹™±¥Ñ½Õ¹Ð°(€€€€€€€€€É•Ù¥•Ý½Õ¹ÐèÉ•Í½±Ù•‘AÉ½™¥±”¹É•Ù¥•Ý½Õ¹Ð°(€€€€€€€€€Í¡…‘½Ý=¹±äèÑÉÕ”°(€€€€€€€ô°(€€€€€€€É•ÅÕ¥É•µ•¹ÑÌèÉ•ÅÕ¥É•µ•¹ÑÌ¹µ…À¡É•ÅÕ¥É•µ•¹Ð€ôø€¡ì(€€€€€€€€€É•ÅÕ¥É•µ•¹Ñ%èÉ•ÅÕ¥É•µ•¹Ð¹É•ÅÕ¥É•µ•¹Ñ%°(€€€€€€€€€É•ÅÕ¥É•µ•¹ÑQ•áÐèÉ•ÅÕ¥É•µ•¹Ð¹É•ÅÕ¥É•µ•¹ÑQ•áÐ°(€€€€€€€€€Ñ¥•ÈèÉ•ÅÕ¥É•µ•¹Ð¹Ñ¥•È°(€€€€€€€€€­¥¹èÉ•ÅÕ¥É•µ•¹Ð¹­¥¹°(€€€€€€€€€ÍÑ…Ñ”èÉ•ÅÕ¥É•µ•¹Ð¹ÍÑ…Ñ”°(€€€€€€€€€É…Ñ¥½¹…±”èÉ•ÅÕ¥É•µ•¹Ð¹É…Ñ¥½¹…±”°(€€€€€€€€€•Ù¥‘•¹”èÉ•ÅÕ¥É•µ•¹Ð¹±…¥µÌ¹Í±¥” À°€Ð¤¹µ…À¡±…¥´€ôø€¡ì(€€€€€€€€€€€¥è±…¥´¹¥°(€€€€€€€€€€€Í½ÕÉ”è±…¥´¹Í½ÕÉ”°(€€€€€€€€€€€Í½ÕÉ•QåÁ”è±…¥´¹Í½ÕÉ•QåÁ”°(€€€€€€€€€€€Í½ÕÉ•UÉ°è±…¥´¹Í½ÕÉ•UÉ°°(€€€€€€€€€€€•Ù¥‘•¹•±…ÍÌè±…¥´¹•Ù¥‘•¹•±…ÍÌ°(€€€€€€€€€€€‘•Ñ…¥°è±…¥´¹‘•Ñ…¥°°(€€€€€€€€€€€ÍÁ…¹Q•áÐè±…¥´¹ÍÁ…¹Y…±¥‘…Ñ•€ü±…¥´¹ÍÁ…¹Q•áÐ€èÕ¹‘•™¥¹•°(€€€€€€€€€€€™É•Í¡¹•ÍÌè±…¥´¹™É•Í¡¹•ÍÌ°(€€€€€€€€€ô¤¤°(€€€€€€€€€½¹ÑÉ…‘¥Ñ¥½¹ÌèÉ•ÅÕ¥É•µ•¹Ð¹½¹ÑÉ…‘¥Ñ¥½¹Ì¹Í±¥” À°€Ð¤¹µ…À¡±…¥´€ôø€¡ì¥è±…¥´¹¥°Í½ÕÉ”è±…¥´¹Í½ÕÉ”°‘•Ñ…¥°è±…¥´¹‘•Ñ…¥°°Í½ÕÉ•UÉ°è±…¥´¹Í½ÕÉ•UÉ°ô¤¤°(€€€€€€€€€É•ÉÕ¥Ñ•É½¹Ñ•áÐèÉ•ÅÕ¥É•µ•¹Ð¹É•ÉÕ¥Ñ•É½¹Ñ•áÐ°(€€€€€€€ô¤¤°(€€€€€ô(€€€ô¤((€€€É•ÑÕÉ¸9•áÑI•ÍÁ½¹Í”¹©Í½¸¡ì(€€€€€½¬èÑÉÕ”°(€€€€€µ½‘”è¥ÍMÕÁ…‰…Í•½¹™¥ÕÉ• ¤€ü€ÍÕÁ…‰…Í”œ€è€ÁÉ•Ù¥•Üœ(€€€€€…¹‘¥‘…Ñ•Ìè…ÍÍ•ÍÍµ•¹ÑÌ°(€€€€€ÑÉÕÍÐèì(€€€€€€€‘•¥Í¥½¸è€Q¡¥Ì¥Ì…¸•Ù¥‘•¹”É•Ù¥•ÜÍ±…Ñ”°¹½Ð„™¥ÐÍ½É”°É…¹­¥¹œ°É•©•Ñ¥½¸°½È¡¥É¥¹œÉ•½µµ•¹‘…Ñ¥½¸¸œ°(€€€€€€€Õ¹­¹½Ý¸è€5¥ÍÍ¥¹œ•Ù¥‘•¹”É•µ…¥¹ÌÕ¹­¹½Ý¸…¹¹•Ù•È‰•½µ•Ì„¹•…Ñ¥Ù”™¥¹‘¥¹œ¸œ°(€€€€€€€Í•¹Í¥Ñ¥Ù”è€±•…É…¹”°É•‘•¹Ñ¥…±Ì°‘¥ÍÅÕ…±¥™¥•ÉÌ°…¹½Ñ¡•ÈÍ•¹Í¥Ñ¥Ù”É•ÅÕ¥É•µ•¹ÑÌÉ•µ…¥¸Ù•É¥™¥…Ñ¥½¸µ…Ñ•¸œ°(€€€€€€€‘¥Í½Ù•Éäè€I•ÉÕ¥Ñ•Èµ…ÁÁÉ½Ù•Í•…É •áÁ…¹Í¥½¹Ìµ…ä•áÁ±…¥¸Ý¡ä„Á•ÉÍ½¸ÍÕÉ™…•‰ÕÐ…¹¹½ÐÍ…Ñ¥Í™ä„É•ÅÕ¥É•µ•¹Ð‰äÑ¡•µÍ•±Ù•Ì¸œ°(€€€€€€€É•Í½±ÕÑ¥½¸è€XÌÔÉ•Í½±Ù•ÁÉ½™¥±”™¥•±‘Ì…É”„É•…µ½¹±äÍ¡…‘½ÜÁÉ½©•Ñ¥½¸½Ù•È…ÑÑ…¡•½‰Í•ÉÙ…Ñ¥½¹Ì¸½¹™±¥ÑÌÉ•µ…¥¸Ù¥Í¥‰±”…¹¹¼Í…±…ÈÙ…±Õ”¥ÌÍ¥±•¹Ñ±ä½Ù•ÉÝÉ¥ÑÑ•¸¸œ°(€€€€€ô°(€€€ô¤(€ô…Ñ €¡•ÉÉ½È¤ì(€€€É•ÑÕÉ¸9•áÑI•ÍÁ½¹Í”¹©Í½¸¡ì½¬è™…±Í”°•ÉÉ½Èè•ÉÉ½È¥¹ÍÑ…¹•½˜ÉÉ½È€ü•ÉÉ½È¹µ•ÍÍ…”€è€I½±”•Ù¥‘•¹”…ÍÍ•ÍÍµ•¹Ð™…¥±•¸œô°ìÍÑ…ÑÕÌè€ÔÀÀô¤(€ô)ô(