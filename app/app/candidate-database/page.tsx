import { TalentWorkspaceV37 } from '@/components/TalentWorkspaceV37'

export const metadata = {
  title: 'Talent | SourcingOS',
  description: 'Search and review canonical people in the owner-scoped Candidate Graph.',
  robots: { index: false, follow: false },
}

export default async function TalentPage({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  const sp = (await searchParams) || {}
  return <TalentWorkspaceV37 initialQuery={sp.q || ''} />
}
