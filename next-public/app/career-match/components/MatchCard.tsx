import type { JobMatchResult } from '@/lib/career-match/types'
import { getRoleFamilyLabel } from '@/lib/career-match/role-taxonomy'

type Props = {
  match: JobMatchResult
  compactNested?: boolean
}

function scoreClass(score: number) {
  if (score >= 68) return 'cm-score strong'
  if (score >= 50) return 'cm-score good'
  if (score >= 30) return 'cm-score adjacent'
  return 'cm-score stretch'
}

export function MatchCard({ match, compactNested = false }: Props) {
  const job = match.job
  return (
    <article className={compactNested ? 'cm-match-card cm-match-card-nested' : 'cm-match-card'}>
      <div className="cm-match-head">
        <div>
          <p className="cm-kicker">{match.fitBand} | {getRoleFamilyLabel(match.jobFamily)}</p>
          <h3>{job.title}</h3>
          <p className="muted">{job.company} | {job.location || 'Location not listed'}</p>
        </div>
        <div className={scoreClass(match.score)} aria-label={`Fit score ${match.score} out of 100`}>
          <strong>{match.score}</strong>
          <span>/100</span>
        </div>
      </div>

      <div className="chips">
        {match.qualityBadges?.slice(0, 6).map(badge => <span className="chip cm-quality-chip" key={badge}>{badge}</span>)}
        {job.collapsedPostingCount && job.collapsedPostingCount > 1 ? <span className="chip">Collapsed {job.collapsedPostingCount} postings</span> : null}
        {job.remoteType ? <span className="chip">{job.remoteType}</span> : null}
        {job.employmentType ? <span className="chip">{job.employmentType}</span> : null}
        {job.salaryRange ? <span className="chip">{job.salaryRange}</span> : null}
        {job.source ? <span className="chip">Source: {job.source}</span> : null}
      </div>

      {job.alternateLocations && job.alternateLocations.length > 1 ? (
        <p className="cm-location-note">This card combines similar postings across: {job.alternateLocations.slice(0, 8).join(' | ')}{job.alternateLocations.length > 8 ? ` | +${job.alternateLocations.length - 8} more` : ''}</p>
      ) : null}

      <div className="cm-panels">
        <section>
          <h4>Why this fits</h4>
          <ul>
            {match.explanation.fitReasons.map(reason => <li key={reason}>{reason}</li>)}
          </ul>
        </section>

        <section>
          <h4>Potential gaps</h4>
          <ul>
            {match.explanation.potentialGaps.map(gap => <li key={gap}>{gap}</li>)}
          </ul>
        </section>

        <section>
          <h4>Resume angle</h4>
          <p className="cm-mini-label">Found in resume</p>
          <ul>
            {match.explanation.resumeAngle.foundInResume.map(item => <li key={item}>{item}</li>)}
          </ul>
          <p className="cm-mini-label">Suggested positioning</p>
          <ul>
            {match.explanation.resumeAngle.suggestedPositioning.map(item => <li key={item}>{item}</li>)}
          </ul>
        </section>
      </div>

      <details className="cm-details">
        <summary>Score breakdown and cautions</summary>
        <div className="cm-breakdown-grid">
          {Object.entries(match.scoreBreakdown).map(([key, value]) => (
            <div key={key} className="cm-breakdown-row">
              <span>{key}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        {match.explanation.cautionNotes.length ? (
          <ul className="cm-cautions">
            {match.explanation.cautionNotes.map(note => <li key={note}>{note}</li>)}
          </ul>
        ) : null}
      </details>

      <div className="button-row">
        <a className="btn" href={job.applyUrl} target="_blank" rel="noreferrer">Open original posting</a>
        {job.sourceUrl && job.sourceUrl !== job.applyUrl ? (
          <a className="btn secondary" href={job.sourceUrl} target="_blank" rel="noreferrer">View source</a>
        ) : null}
      </div>
    </article>
  )
}
