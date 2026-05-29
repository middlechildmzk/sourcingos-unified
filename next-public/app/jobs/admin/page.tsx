import { JobsReviewClient } from '@/components/JobsReviewClient'

export const metadata = {
  title: 'Jobs Review Queue | SourcingOS',
  description: 'Preview admin review queue for SourcingOS Jobs employer submissions.'
}

export default function JobsAdminPage(){
 return <main className="wrap">
  <div className="eyebrow">SourcingOS Jobs admin</div>
  <h1>Employer submission review queue</h1>
  <p className="lead">Review submitted recruiter, sourcer, TA, recruiting operations, healthcare recruiting, and GovCon recruiting roles before they appear publicly.</p>
  <JobsReviewClient />
 </main>
}
