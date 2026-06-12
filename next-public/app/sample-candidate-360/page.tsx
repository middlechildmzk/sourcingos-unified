// ─────────────────────────────────────────────────────────────────────────────
// /sample-candidate-360 — PUBLIC demo of the Candidate 360 dossier.
// 100% synthetic data. No real person. Clearly labeled throughout.
// Framed as a FORWARDABLE SOURCER ARTIFACT, not a candidate database page:
// it answers "why should a recruiter/HM trust this recommendation?"
// ─────────────────────────────────────────────────────────────────────────────
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Sample Candidate 360 — Evidence-first sourcing | SourcingOS',
  description:
    'A synthetic Candidate 360 dossier: candidate evidence, role-fit reasoning, risk flags, and hiring-manager-ready summaries. SourcingOS shows the evidence behind every recommendation.',
}

const ledger = [
  { signal: 'Kubernetes experience', evidence: 'Sustained public platform work in a DevSecOps context — operators, Helm charts, 2021–2026 activity', sourceType: 'GitHub / Public Profile', confidence: 'Medium-High', verify: 'Confirm hands-on production ownership vs exposure' },
  { signal: 'Security clearance fit', evidence: 'Public resume indicates active TS/SCI eligibility', sourceType: 'Clearance-oriented sourcing lane', confidence: 'Low-Medium', verify: 'Verify current clearance status and adjudication date directly with candidate' },
  { signal: 'CI/CD background', evidence: 'GitLab CI pipelines and deployment automation referenced across repos and a public talk', sourceType: 'Resume / Repo Evidence', confidence: 'Medium', verify: 'Confirm scale, tooling, and production ownership' },
  { signal: 'GovCon adjacency', evidence: 'Past employer appears in the federal contractor ecosystem (prime/sub mapping)', sourceType: 'Company Mapping', confidence: 'Medium', verify: 'Confirm contract/program relevance and any conflict constraints' },
  { signal: 'RMF / ATO awareness', evidence: '"Shifting RMF Left" — public conference talk listing (2025)', sourceType: 'Conference / Community', confidence: 'High', verify: 'Confirm role in ATO packages vs general familiarity' },
  { signal: 'Open-to-work signal', evidence: '"Exploring new opportunities" on a public profile README', sourceType: 'Public Profile Signal', confidence: 'Low', verify: 'Treat as a signal, not a verified claim — confirm interest in first call' },
]

const mustHaves = [
  { req: 'Kubernetes in production', status: 'Evidence found — confirm ownership', tone: 'good' },
  { req: 'Terraform / IaC', status: 'Evidence found', tone: 'good' },
  { req: 'Active TS/SCI', status: 'Unverified breadcrumb — must confirm before submittal', tone: 'warn' },
  { req: 'CI/CD hardening in an RMF/ATO context', status: 'Strong indirect evidence (talk + repos)', tone: 'good' },
]
const niceToHaves = [
  { req: 'AWS GovCloud', status: 'Evidence found (baseline modules, original PRs)', tone: 'good' },
  { req: 'Sec+ / CISSP (8140)', status: 'No public signal — ask', tone: 'warn' },
  { req: 'Mentoring / tech lead experience', status: 'No public signal — ask', tone: 'warn' },
]

export default function SampleCandidate360Page() {
  return (
    <main className="wrap">
      {/* ── Demo disclaimer ── */}
      <div className="cta" style={{ marginTop: 24, borderColor: 'var(--accent)' }}>
        <strong>Synthetic demo data.</strong> No real candidate identity is shown. “Jordan A.” and
        every evidence item below are invented to demonstrate the dossier format.
      </div>

      {/* ── Hero ── */}
      <section className="wrap hero" style={{ paddingTop: 28 }}>
        <div className="eyebrow">Candidate 360 · Sample artifact</div>
        <h1>See what evidence-first sourcing looks like.</h1>
        <p className="lead">
          SourcingOS turns messy reqs into candidate evidence, role-fit reasoning, risk flags, and
          hiring-manager-ready summaries. This is the artifact a sourcer forwards — not a search
          results page.
        </p>
        <p className="lead" style={{ fontSize: 16 }}>
          <strong>SourcingOS does not just score candidates. It shows the evidence behind the
          recommendation.</strong>
        </p>
        <div className="hero-actions">
          <Link className="btn" href="/waitlist">Join the private beta</Link>
          <Link className="btn secondary" href="/tools/jd-search-strategy">Try the free JD Strategy Tool</Link>
        </div>
      </section>

      {/* ── 1. Role context ── */}
      <section className="section">
        <div className="section-eyebrow"><span className="section-tag">1 · Role context</span></div>
        <div className="card">
          <span className="kicker">The search this dossier answers</span>
          <h3>Cleared DevSecOps Engineer — Northern Virginia or Remote-US</h3>
          <p className="muted">
            Must-haves: Kubernetes in production, Terraform/IaC, active TS/SCI, CI/CD hardening in
            an RMF/ATO environment. Req age: 47 days. Lanes already exhausted before SourcingOS:
            LinkedIn Recruiter saved search, ClearanceJobs alerts. The HM’s stated pain: “everyone
            we see has the clearance or the platform depth, never both.”
          </p>
        </div>
      </section>

      {/* ── 2. Candidate snapshot ── */}
      <section className="section">
        <div className="section-eyebrow"><span className="section-tag">2 · Candidate snapshot</span></div>
        <div className="card">
          <span className="kicker">SAMPLE · Synthetic profile · Identity recruiter-confirmed</span>
          <h2 style={{ marginTop: 6 }}>Jordan A. — DevSecOps Engineer (sample)</h2>
          <p className="muted">
            Public evidence suggests a DevSecOps engineer with sustained Kubernetes and Terraform
            activity, GovCloud-adjacent delivery, and public speaking on RMF-aware pipelines. A
            self-stated clearance breadcrumb appears on a public resume and <strong>would need
            verification</strong>. Three source profiles roll up into this record — SourcingOS
            proposed the identity match; <strong>a recruiter approved it</strong>. Nothing merged
            silently.
          </p>
        </div>
      </section>

      {/* ── 3 + 4. Requirement tables ── */}
      <section className="section">
        <div className="section-eyebrow"><span className="section-tag">3 · Must-have match &nbsp;/&nbsp; 4 · Bonus signals</span></div>
        <div className="grid two">
          <div className="card">
            <span className="kicker">Must-have match</span>
            {mustHaves.map((m, i) => (
              <p key={i} style={{ margin: '10px 0' }}>
                <strong>{m.req}</strong><br />
                <span className="muted" style={{ color: m.tone === 'warn' ? '#c8a84b' : undefined }}>{m.status}</span>
              </p>
            ))}
          </div>
          <div className="card">
            <span className="kicker">Nice-to-have / bonus signals</span>
            {niceToHaves.map((m, i) => (
              <p key={i} style={{ margin: '10px 0' }}>
                <strong>{m.req}</strong><br />
                <span className="muted" style={{ color: m.tone === 'warn' ? '#c8a84b' : undefined }}>{m.status}</span>
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Evidence ledger ── */}
      <section className="section">
        <div className="section-eyebrow"><span className="section-tag">5 · Evidence ledger</span></div>
        <h2 className="section-title">Every claim has a source. Every source is visible.</h2>
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--muted)' }}>
                <th style={{ padding: '8px 12px' }}>Signal</th>
                <th style={{ padding: '8px 12px' }}>Evidence</th>
                <th style={{ padding: '8px 12px' }}>Source type</th>
                <th style={{ padding: '8px 12px' }}>Confidence</th>
                <th style={{ padding: '8px 12px' }}>What to verify</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((e, i) => (
                <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}><strong>{e.signal}</strong></td>
                  <td style={{ padding: '10px 12px' }} className="muted">{e.evidence}</td>
                  <td style={{ padding: '10px 12px' }}>{e.sourceType}</td>
                  <td style={{ padding: '10px 12px' }}>{e.confidence}</td>
                  <td style={{ padding: '10px 12px' }} className="muted">{e.verify}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Nothing is marked “verified.” That’s deliberate: open-web signals are leads, not facts —
          and the distinction stays visible all the way to the hiring manager.
        </p>
      </section>

      {/* ── 6. Source lane context ── */}
      <section className="section">
        <div className="section-eyebrow"><span className="section-tag">6 · Source lane context</span></div>
        <div className="grid two">
          <div className="card">
            <span className="kicker">Lanes that produced this profile</span>
            <h3>GitHub · Public resume X-Ray · Conference/community · Company mapping</h3>
            <p className="muted">
              4 of 6 lanes in this role’s source pack yielded evidence. The candidate first
              surfaced in the GitHub lane — a lane the previous LinkedIn-only search never touched.
            </p>
          </div>
          <div className="card">
            <span className="kicker">Lanes that came up empty</span>
            <h3>OpenAlex · arXiv (research lanes)</h3>
            <p className="muted">
              Zero results — recorded as a lane outcome, not hidden. Lane yield is tracked so the
              next search for this role family starts smarter.
            </p>
          </div>
        </div>
      </section>

      {/* ── 7. Why worth reviewing ── */}
      <section className="section">
        <div className="section-eyebrow"><span className="section-tag">7 · Why this candidate is worth reviewing</span></div>
        <div className="card">
          <p className="muted">
            This profile matches 3 of 4 must-haves with medium-to-high-confidence public evidence,
            including the rare combination the HM flagged: platform depth <em>and</em> a credible
            clearance signal. The evidence spans independent sources (code, talk, resume, company
            graph) rather than one self-written profile — which is exactly what reduces
            false-positive risk on hard searches. Project-specific fit draft: <strong>78/100</strong>
            (declared weights; capped by the unverified clearance — this is a fit-for-this-role
            estimate, never a judgment of the person).
          </p>
        </div>
      </section>

      {/* ── 8. Risks / unknowns ── */}
      <section className="section">
        <div className="section-eyebrow"><span className="section-tag">8 · Risks, unknowns, and what NOT to assume</span></div>
        <div className="card">
          <p className="muted">
            Clearance status is self-stated and unverified — do not represent it to the HM as
            confirmed. Current employer unknown; public activity may lag reality. Compensation
            expectations unknown. No certification signals found — absence of public signal is not
            absence of the credential. Do not assume availability from the open-to-work signal.
          </p>
        </div>
      </section>

      {/* ── 9. Verify next ── */}
      <section className="section">
        <div className="section-eyebrow"><span className="section-tag">9 · What to verify next</span></div>
        <div className="card">
          <p className="muted">
            1. Clearance level + adjudication date, directly with the candidate. 2. Current
            employer and prime/sub conflict constraints. 3. Hands-on GovCloud ownership vs
            adjacency. 4. 8140 certification status (Sec+/CISSP). 5. Interest level and timeline —
            the open-to-work signal is a lead, not consent.
          </p>
        </div>
      </section>

      {/* ── 10. HM talking points ── */}
      <section className="section">
        <div className="section-eyebrow"><span className="section-tag">10 · Hiring manager talking points</span></div>
        <div className="card">
          <p className="muted">
            “Public evidence shows sustained k8s/Terraform delivery and an RMF-aware mindset — a
            conference talk on shifting RMF left, plus hardened-pipeline repos. The clearance is
            self-stated; I’ll verify before anything moves. If it holds, this is the
            depth-plus-clearance profile we haven’t seen in 47 days. One calibration question for
            you: is hands-on GovCloud a must-have, or trainable in 90 days?”
          </p>
        </div>
      </section>

      {/* ── 11 + 12. Export CTA + trust + beta CTA ── */}
      <section className="section">
        <div className="section-eyebrow"><span className="section-tag">11 · Forward it</span></div>
        <div className="card">
          <span className="kicker">Export &amp; share</span>
          <h3>This dossier is built to be forwarded.</h3>
          <p className="muted">
            In the beta workbench, Candidate 360s export as hiring-manager-ready summaries — with
            the evidence ledger, risk flags, and verify-next list intact, so the recommendation
            travels with its proof.
          </p>
        </div>
      </section>

      <div className="waitlist-section">
        <div className="waitlist-inner">
          <div className="eyebrow" style={{ justifyContent: 'center', display: 'flex', marginBottom: 12 }}>Why this is different</div>
          <h2>No silent merges. No invented evidence.</h2>
          <p>
            SourcingOS does not infer protected attributes, silently merge identities, invent
            employment history, or present uncertain data as fact. Identity matches are proposed by
            the system and confirmed by a recruiter. Human review is required before outreach,
            submission, or any hiring decision.
          </p>
          <Link className="btn" href="/waitlist">Join the private beta</Link>
        </div>
      </div>
    </main>
  )
}
