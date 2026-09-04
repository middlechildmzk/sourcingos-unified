import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Search | SourcingOS',
  robots: { index: false, follow: false },
}

export default function AgenticSourcingPage() {
  redirect('/app/search?from=agentic-sourcing')
}
