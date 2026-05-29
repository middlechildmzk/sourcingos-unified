import { JobSubmitForm } from '@/components/JobSubmitForm'

export const metadata = {
  title: 'Post a Recruiting Job | SourcingOS Jobs',
  description: 'Submit recruiter, sourcer, TA, recruiting ops, healthcare recruiting, GovCon recruiting, and AI recruiting jobs for SourcingOS review.'
}

export default function SubmitJobPage() {
  return (
    <main>
      <section className="wrap hero">
        <div className="eyebrow">Employer submissions</div>
        <h1>Post a recruiter or sourcer job.</h1>
        <p className="lead">SourcingOS Jobs is curated for roles involving sourcing, recruiting, recruiting operations, healthcare recruiting, GovCon recruiting, technical recruiting, and AI hiring. Submissions go through review before appearing publicly.</p>
      </section>
      <section className="wrap grid two">
        <div className="card">
          <h2>Submission rules</h2>
          <p className="muted">This is a curated link-out job board. Jobs should have a direct apply URL, clear location/remote status, salary if available, and recruiter-specific metadata.</p>
          <ul className="muted">
            <li>Accepted: recruiter, sourcer, recruiting ops, TA, HR ops, people ops, healthcare recruiting, cleared/GovCon recruiting, technical recruiting.</li>
            <li>Preferred: remote-friendly, sourcing-heavy, salary-visible, direct ATS/company link.</li>
            <li>Not accepted: vague staffing spam, no apply link, misleading salary, or jobs copied without permission.</li>
          </ul>
        </div>
        <JobSubmitForm />
      </section>
    </main>
  )
}
