import type { Metadata } from 'next'
import { SearchWorkspace } from '@/components/SearchWorkspace'

export const metadata: Metadata = {
  title: 'Search · SourcingOS',
  description: 'Conversational, evidence-first talent search workspace.',
}

export default function SearchPage() {
  return <SearchWorkspace />
}
