import type { Metadata } from 'next'
import { SearchWorkspaceV38_1 } from '@/components/SearchWorkspaceV38_1'

export const metadata: Metadata = {
  title: 'Search · SourcingOS',
  description: 'Conversational, evidence-first talent search and candidate review workspace.',
}

export default async function SearchPage({ searchParams }: { searchParams?: Promise<{ q?: string; roleId?: string; from?: string }> }) {
  const sp = (await searchParams) || {}
  return <SearchWorkspaceV38_1 initialQuery={sp.q || ''} roleId={sp.roleId} source={sp.from || 'direct'} />
}
