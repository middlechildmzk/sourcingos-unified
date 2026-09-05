import { ImportCenterClient } from '@/components/ImportCenterClient'

export const metadata = {
  title: 'Import Center | SourcingOS',
  description: 'Prepare authorized candidate exports and resumes, map fields, preview duplicates, and import into the owner-scoped Candidate Graph.',
  robots: { index: false, follow: false },
}

export default function ImportCenterPage() {
  return <main className="wrap"><ImportCenterClient /></main>
}
