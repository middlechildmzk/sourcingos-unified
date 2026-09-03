import { PeopleSearchFlagshipV36_12 } from '@/components/PeopleSearchFlagshipV36_12'
import '../candidate-search/universal-people-search.css'

export const metadata = {
  title: 'People Search — SourcingOS',
  description: 'Find a person by name, email, phone, professional profile URL, or professional attributes across connected SourcingOS data sources.',
  robots: { index: false, follow: false },
}

export default function PeopleSearchPage() {
  return (
    <main className="wrap">
      <div className="eyebrow">SourcingOS · People Search</div>
      <h1 style={{ marginBottom: 6 }}>Find people.</h1>
      <p className="lead" style={{ maxWidth: 760, marginTop: 0, marginBottom: 20 }}>
        Search a person you know or describe the kind of candidate you need. SourcingOS chooses the connected sources behind the scenes.
      </p>
      <PeopleSearchFlagshipV36_12 />
    </main>
  )
}
