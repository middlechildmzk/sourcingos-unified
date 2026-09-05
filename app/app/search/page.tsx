import type { Metadata } from 'next'
import { PeopleSearchWorkspaceV38_4 } from '@/components/PeopleSearchWorkspaceV38_4'

export const metadata: Metadata = {
  title: 'People Search · SourcingOS',
  description: 'Conversational talent sourcing, known-person lookup, unified candidate review, and evidence-first contact workflows.',
}

export default async function SearchPage({ searchParams }: { searchParams?: Promise<{ q?: string; roleId?: string; from?: string }> }) {
  const sp = (await searchParams) || {}
  return <PeopleSearchWorkspaceV38_4 initialQuery={sp.q || ''} roleId={sp.roleId} source={sp.from || 'direct'} />
}
