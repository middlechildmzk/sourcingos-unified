import Link from 'next/link'

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
        <p className="lead">SourcingOS Jobs is curated for roles involving sourcing, recruiting, recruiting operations, healthcare recruiting, GovCon recruiting, technical recruiting, and AI hiring.</p>
      </section>
      <section className="wrap grid two">
        <div className="card">
          <h2>V1 submission rules</h2>
          <p className="muted">This is a curated link-out job board. Jobs should have a direct apply URL, clear location/remote status, salary if available, and recruiter-specific metadata.</p>
          <ul className="muted">
            <li>Accepted: recruiter, sourcer, recruiting ops, TA, HR ops, people ops, healthcare recruiting, cleared/GovCon recruiting, technical recruiting.</li>
            <li>Preferred: remote-friendly, sourcing-heavy, salary-visible, direct ATS/company link.</li>
            <li>Not accepted: vague staffing spam, no apply link, misleading salary, or jobs copied without permission.</li>
          </ul>
        </div>
        <form className="card">
          <label>Job title</label>
          <input className="input" placeholder="Senior Technical Sourcer" />
          <label>Company</label>
          <input className="input" placeholder="Company name" />
          <label>Apply URL</label>
          <input className="input" placeholder="https://company.com/careers/job" />
          <label>Salary range</label>
          <input className="input" placeholder="$120k-$160k or $70-$95/hr" />
          <label>Notes</label>
          <textarea className="textarea" placeholder="Remote type, specialty, ATS, sourcing-heavy details, clearance/healthcare/AI focus..." />
          <p className="muted">Preview form only. Next step is wiring submissions to Supabase or a moderated inbox.</p>
          <Link className="btn" href="/waitlist">Join employer updates</Link>
        </form>
      </section>
    </main>
  )
}
