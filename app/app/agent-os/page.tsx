import { permanentRedirect } from 'next/navigation'

export const metadata = {
  title: 'Today | SourcingOS',
  description: 'SourcingOS recruiter decision inbox.',
  robots: { index: false, follow: false },
}

export default function AgentOSPage() {
  permanentRedirect('/app/today/')
}
