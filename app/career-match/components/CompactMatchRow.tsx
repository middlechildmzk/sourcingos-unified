import type { JobMatchResult } from '@/lib/career-match/types'
import { getRoleFamilyLabel } from '@/lib/career-match/role-taxonomy'
import { MatchCard } from './MatchCard'

type Props = {
  match: JobMatchResult
}

export function CompactMatchRow({ match }: Props) {
  const job = match.job
  return (
    <details className="cm-compact-match">
      <summary>
        <span className="cm-compact-main">
          <strong>{job.title}</strong>
          <span>{job.company} | {job.location || 'Location not listed'}</span>
        </span>
        <span className="cm-compact-meta">
          <span>{match.fitBand}</span>
          <span>{getRoleFamilyLabel(match.jobFamily)}</span>
          <strong>{match.score}/100</strong>
        </span>
      </summary>
      <MatchCard match={match} compactNested />
    </details>
  )
}
