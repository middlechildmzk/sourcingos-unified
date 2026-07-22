import { TodayInboxClient } from '@/components/TodayInboxClient'

export const metadata = {
  title: 'Today | SourcingOS',
  robots: { index: false, follow: false },
}

export default function TodayPage() {
  return (
    <main className="wrap">
      <TodayInboxClient />
    </main>
  )
}
