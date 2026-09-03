import { Candidate360Client } from '@/components/Candidate360Client'
import { CandidateArtifactsV36_10 } from '@/components/CandidateArtifactsV36_10'
import { CandidateFieldResolutionV36_10 } from '@/components/CandidateFieldResolutionV36_10'
import { DeleteCandidateRecord } from '@/components/DeleteCandidateRecord'
import { RoleCandidateEvidenceAnalysisClient } from '@/components/RoleCandidateEvidenceAnalysisClient'

export const metadata = {
  title: 'Candidate 360 — SourcingOS',
  description: 'Review source-linked candidate evidence, identity provenance, resolved profile fields, candidate artifacts, contact and availability signals, role-specific requirement coverage, and candidate data controls.',
  robots: { index: false, follow: false },
}

export default async function Candidate360Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ roleId?: string }> }) {
  const { id } = await params
  const sp = (await searchParams) ?? {}
  const roleId = typeof sp.roleId === 'string' ? sp.roleId : undefined
  return <main className="wrap">
    <Candidate360Client candidateId={id} roleId={roleId} />
    <CandidateFieldResolutionV36_10 candidateId={id} />
    <CandidateArtifactsV36_10 candidateId={id} />
    {roleId && <RoleCandidateEvidenceAnalysisClient candidateId={id} roleId={roleId} />}
    <DeleteCandidateRecord candidateId={id} roleId={roleId} />
  </main>
}
