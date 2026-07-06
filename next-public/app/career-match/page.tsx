import type { Metadata } from 'next'
import CareerMatchClient from './CareerMatchClient'
import './career-match.css'

export const metadata: Metadata = {
  title: 'SourcingOS Career Match | AI job matching for recruiters and sourcers',
  description: 'Upload or paste your recruiting resume text and get recruiter-grade job matches, adjacent role suggestions, and grounded resume positioning from SourcingOS.',
}

export default function CareerMatchPage() {
  return (
    <main>
      <section className="hero cm-hero">
        <div className="wrap cm-hero-grid">
          <div>
            <span className="eyebrow">SourcingOS Career Match</span>
            <h1>Find your next recruiting role with a system that reads like a senior sourcer.</h1>
            <p className="lead">
              Paste your recruiting resume, choose your preferences, and get matched to recruiter, sourcer, TA, ops,
              talent intelligence, RPO, healthcare, AI, and federal recruiting lanes with clear reasons and honest gaps.
            </p>
            <div className="hero-actions">
              <a className="btn" href="#career-match-tool">Start free match</a>
              <a className="btn secondary" href="/jobs">Browse recruiting jobs</a>
            </div>
          </div>
          <div className="card cm-hero-card">
            <span className="kicker">V1 trust rules</span>
            <ul>
              <li>No auto-apply.</li>
              <li>No fake job data.</li>
              <li>No invented achievements.</li>
              <li>No verified-clearance claims.</li>
              <li>Every match includes why, gaps, and resume angle.</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="career-match-tool" className="wrap cm-tool-wrap">
        <CareerMatchClient />
      </section>
    </main>
  )
}
