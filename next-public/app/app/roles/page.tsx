import { RolesPortfolioV37 } from '@/components/RolesPortfolioV37'

export const metadata = {
  title: 'Roles | SourcingOS',
  description: 'Manage role briefs, candidate slates, sourcing strategy, and recruiter decisions.',
  robots: { index: false, follow: false },
}

export default function RolesPage() {
  return <RolesPortfolioV37 />
}
