import { AutoSourceCommandCenterClient } from '@/components/AutoSourceCommandCenterClient'

export const metadata = {
  title: 'AutoSource — SourcingOS',
  description: 'Run recruiter-controlled candidate discovery, enrichment, identity review, and prioritized AutoSource campaigns.',
  robots: { index: false, follow: false },
}

export default function AutoSourcePage() {
  return <main className="wrap"><AutoSourceCommandCenterClient /></main>
}