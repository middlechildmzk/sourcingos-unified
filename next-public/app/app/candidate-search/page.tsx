import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Search — SourcingOS',
  robots: { index: false, follow: false },
}

export default async function CandidateSearchPage({ searchParams }: { searchParams?: Promise<{ roleId?: string; laneId?: string }> }) {
  const sp = (await searchParams) ?? {}
  const params = new URLSearchParams({ from: 'candidate-search' })
  if (typeof sp.roleId === 'string' && sp.roleId.trim()) params.set('roleId', sp.roleId.trim())
  if (typeof sp.laneId === 'string' && sp.laneId.trim()) params.set('laneId', sp.laneId.trim())
  redirect(`/app/search?${params.toString()}`)
}
