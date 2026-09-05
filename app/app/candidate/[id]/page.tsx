import { redirect } from 'next/navigation'
import { Candidate360Client } from '@/components/Candidate360Client'
import { CandidateArtifactsV36_10 } from '@/components/CandidateArtifactsV36_10'
import { CandidateEnrichmentV40_4 } from '@/components/CandidateEnrichmentV40_4'
import { CandidateFieldResolutionV36_10 } from '@/components/CandidateFieldResolutionV36_10'
import { DeleteCandidateRecord } from '@/components/DeleteCandidateRecord'
import { RoleCandidateEvidenceAnalysisClient } from '@/components/RoleCandidateEvidenceAnalysisClient'
import { resolveCanonicalCandidateIdV36_10 } from '@/lib/candidate-identity-redirects-v36-10'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getRouteSession } from '@/lib/supabase/route-session'

export const metadata = {
  title: 'Candidate 360 — SourcingOS',
  description: 'Review source-linked candidate evidence, identity provenance, autonomous enrichment, candidate artifacts, contact and availability signals, role-specific requirement coverage, and candidate data controls.',
  robots: { index: false, follow: false },
}

export default async function Candidate360Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ roleId?: string }> }) {
  const { id } = await params
  const sp = (await searchParams) ?? {}
  const roleId = typeof sp.roleId === 'string' ? sp.roleId : undefined

  if (isSupabaseConfigured()) {
    const session = await getRouteSession()
    const sb = session.authenticated ? createServerSupabaseClient() : null
    if (session.authenticated && session.userId && sb) {
      const canonical = await resolveCanonicalCandidateIdV36_10({ sb, ownerId: session.userId, candidateId: id })
      if (canonical.redirected) {
        const params = new URLSearchParams()
        if (roleId) params.set('roleId', roleId)
        const suffix = params.size ? `?${params.toString()}` : ''
        redirect(`/app/candidate/${encodeURIComponent(canonical.candidateId)}${suffix}`)
      }
    }
  }

  return <main className="wrap">
    <Candidate360Client candidateId={id} roleId={roleId} />
    <CandidateFieldResolutionV36_10 candidateId={id} />
    <CandidateEnrichmentV40_4 candidateId={id} />
    <CandidateArtifactsV36_10 candidateId={id} />
    {roleId && <RoleCandidateEvidenceAnalysisClient candidateId={id} roleId={roleId} />}
    <DeleteCandidateRecord candidateId={id} roleId={roleId} />
  </main>
}
