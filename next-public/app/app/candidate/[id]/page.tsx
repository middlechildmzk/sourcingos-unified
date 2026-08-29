import { Candidate360Client } from '@/components/Candidate360Client'
import { DeleteCandidateRecord } from '@/components/DeleteCandidateRecord'

export const metadata = {
  title: 'Candidate 360 — SourcingOS',
  description: 'Review source-linked candidate evidence, identity provenance, contact and availability signals, graph relationships, role handoff, and candidate data controls.',
  robots: { index: false, follow: false },
}

export default async function Candidate360Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ roleId?: string }> }) {
  const { id } = await params
  const sp = (await searchParams) ?? {}
  const roleId = typeof sp.roleId === 'string' ? sp.roleId : undefined
  return <main className="wrap">
    <Candidate360Client candidateId={id} roleId={roleId} />
    <DeleteCandidateRecord candidateId={id} roleId={roleId} />
  </main>
}
