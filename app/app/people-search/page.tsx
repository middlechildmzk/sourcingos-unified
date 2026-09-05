import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Search — SourcingOS',
  robots: { index: false, follow: false },
}

export default function PeopleSearchPage() {
  redirect('/app/search?from=people-search')
}
