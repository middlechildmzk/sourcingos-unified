import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Sources — SourcingOS',
  robots: { index: false, follow: false },
}

export default function CandidateAcquisitionPage() {
  redirect('/app/sources?from=acquisition')
}
