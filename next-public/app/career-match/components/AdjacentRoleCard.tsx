import type { AdjacentRole } from '@/lib/career-match/types'

type Props = {
  role: AdjacentRole
}

export function AdjacentRoleCard({ role }: Props) {
  return (
    <article className="cm-adjacent-card">
      <p className="cm-kicker">{role.fitBand}</p>
      <h3>{role.label}</h3>
      <ul>
        {role.whyItFits.map(reason => <li key={reason}>{reason}</li>)}
      </ul>
      <p className="muted">{role.bridgeNote}</p>
      <div className="chips">
        {role.searchTerms.slice(0, 4).map(term => <span className="chip" key={term}>{term}</span>)}
      </div>
    </article>
  )
}
