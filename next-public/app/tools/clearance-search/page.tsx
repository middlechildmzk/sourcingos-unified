import { ClearanceSearchTool } from '@/components/ClearanceSearchTool'

export const metadata = {
  title: 'Clearance Search Builder | SourcingOS',
  description:
    'Build compliant Boolean and X-Ray search strings for cleared and GovCon roles — TS/SCI, Top Secret, Secret, CI/Full-Scope poly, and cert lanes. Clearance terms stay out of public X-Ray on purpose. Free, no account.',
}

export default function Page() {
  return (
    <main className="wrap">
      <span className="kicker">Free Tool</span>
      <h1>Clearance Search Builder</h1>
      <p className="lead">
        Build search strings for cleared and GovCon roles the way a cleared recruiter actually
        runs them: clearance terms in the LinkedIn Recruiter and ClearanceJobs lanes where
        candidates self-attest, and deliberately out of public X-Ray, where the open web can&rsquo;t
        verify clearance and the term mostly returns job posts. Pick a level, poly, cert focus, and
        market — get four lanes plus a downloadable pack.
      </p>
      <ClearanceSearchTool />
    </main>
  )
}
