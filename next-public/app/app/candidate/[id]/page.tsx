import { Candidate360Client } from '@/components/Candidate360Client'

export const metadata = {
  title: 'Candidate 360 — SourcingOS',
  description: 'Review source-linked candidate evidence, identity provenance, contact and availability signals, graph relationships, and role handoff.',
  robots: { index: false, follow: false },
}

export default async function Candidate360Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ roleId?: string }> }) {
  const { id } = await params
  const sp = (await searchParams) ?? {}
  const roleId = typeof sp.roleId === 'string' ? sp.roleId : undefined
  return <main className="wrap"><Candidate360Client candidateId={id} roleId={roleId} /></main>
}
