import type { Metadata } from 'next'
import { SearchWorkspaceV37 } from '@/components/SearchWorkspaceV37'

export const metadata: Metadata = {
  title: 'Search · SourcingOS',
  description: 'Conversational, evidence-first talent search workspace.',
}

export default async function SearchPage({ searchParams }: { searchParams?: Promise<{ q?: string; roleId?: string; from?: string }> }) {
  const sp = (await searchParams) || {}
  return <SearchWorkspaceV37 initialQuery={sp.q || ''} roleId={sp.roleId} source={sp.from || 'direct'} />
}
