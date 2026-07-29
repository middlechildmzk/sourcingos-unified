import { Candidate360Client } from '@/components/Candidate360Client'

export const metadata = {
  title: 'Candidate 360 — SourcingOS',
  description: 'Review source-linked candidate evidence, identity provenance, contact and availability signals, graph relationships, and role handoff.',
  robots: { index: false, follow: false },
}

export default function Candidate360Page({ params, searchParams }: { params: { id: string }; searchParams?: { roleId?: string } }) {
  const roleId = typeof searchParams?.roleId === 'string' ? searchParams.roleId : undefined
  return <main className="wrap"><Candidate360Client candidateId={params.id} roleId={roleId} /></main>
}
