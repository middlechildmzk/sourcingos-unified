import { Candidate360Client } from '@/components/Candidate360Client'

export const metadata = {
  title: 'Candidate 360 — SourcingOS',
  description: 'Review source-linked candidate evidence, identity provenance, contact and availability signals, graph relationships, and role handoff.',
  robots: { index: false, follow: false },
}

export default function Candidate360Page({ params }: { params: { id: string } }) {
  return <main className="wrap"><Candidate360Client candidateId={params.id} /></main>
}
