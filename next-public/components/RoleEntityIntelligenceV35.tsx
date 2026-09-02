'use client'

import { useMemo, useState } from 'react'
import { buildRoleEntityIntelligenceV35 } from '@/lib/entity-intelligence/role-intelligence-v35'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

function label(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

export function RoleEntityIntelligenceV35({ roleId }: { roleId: string }) {
  const { roles } = useRoleWorkspaces()
  const role = useMemo(() => roles.find(item => item.id === roleId), [roleId, roles])
  const [activeSuggestions, setActiveSuggestions] = useState<string[]>([])
  const intelligence = useMemo(() => role ? buildRoleEntityIntelligenceV35(role.intake) : null, [role])

  if (!role || !intelligence) return null

  const location = intelligence.location
  const expansions = intelligence.suggestedExpansions.slice(0, 12)
  const toggle = (id: string) => setActiveSuggestions(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])

  return (
    <section className="role-entity-intel-v35" aria-label="Role entity intelligence">
      <div className="role-entity-intel-v35__header">
        <div>
          <div className="eyebrow">V35 entity intelligence</div>
          <h2>What SourcingOS understands</h2>
          <p>Normalized recruiter intent and optional discovery expansions. Suggestions stay inactive unless you select them.</p>
        </div>
        <span className="role-entity-intel-v35__version">{intelligence.version}</span>
      </div>

      <div className="role-entity-intel-v35__grid">
        <article>
          <span className="role-entity-intel-v35__label">Occupation</span>
          <strong>{intelligence.occupation.resolved ? label(intelligence.occupation.family) : 'Needs occupational context'}</strong>
          {!intelligence.occupation.resolved && <small>Unknown is not treated as a negative source judgment.</small>}
        </article>
        <article>
          <span className="role-entity-intel-v35__label">Context</span>
          <strong>{intelligence.contextModifiers.length ? intelligence.contextModifiers.map(label).join(', ') : 'No modifier detected'}</strong>
          <small>Context never replaces the occupation.</small>
        </article>
        <article>
          <span className="role-entity-intel-v35__label">Location</span>
          <strong>{location.anchorLabel || role.intake.location || 'Not resolved'}</strong>
          <small>{label(location.mode)}{location.radiusMiles ? ` · ${location.radiusMiles} miles` : ''}</small>
        </article>
      </div>

      {intelligence.recognized.length > 0 && (
        <div className="role-entity-intel-v35__section">
          <div className="role-entity-intel-v35__section-title">Recognized entities</div>
          <div className="role-entity-intel-v35__chips">
            {intelligence.recognized.slice(0, 14).map(item => (
              <span className="role-entity-intel-v35__chip role-entity-intel-v35__chip--recognized" key={`${item.entity.id}:${item.matchedText}`}>
                {item.entity.canonicalLabel}
                <em>{label(item.entity.kind)}</em>
              </span>
            ))}
          </div>
        </div>
      )}

      {(location.suggestedExpansionIds.length > 0 || expansions.length > 0) && (
        <div className="role-entity-intel-v35__section">
          <div className="role-entity-intel-v35__section-title">Find similar / broaden search</div>
          <p className="role-entity-intel-v35__hint">Preview controls only in this slice. Selecting a suggestion does not rewrite the approved Role Brief or candidate evidence.</p>
          <div className="role-entity-intel-v35__chips">
            {expansions.map(item => {
              const active = activeSuggestions.includes(item.entity.id)
              return (
                <button
                  type="button"
                  key={`${item.entity.id}:${item.relationship?.id || item.matchType}`}
                  className={`role-entity-intel-v35__chip role-entity-intel-v35__chip--button${active ? ' is-active' : ''}`}
                  onClick={() => toggle(item.entity.id)}
                  title={item.explanation}
                >
                  {active ? '✓ ' : '+ '}{item.entity.canonicalLabel}
                  <em>{item.relationship ? label(item.relationship.type) : label(item.matchType)}</em>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {location.ambiguousCandidateIds?.length ? (
        <div className="role-entity-intel-v35__warning">
          Location is ambiguous. SourcingOS did not silently choose one interpretation.
        </div>
      ) : null}

      <details className="role-entity-intel-v35__trust">
        <summary>Why these suggestions are safe</summary>
        <ul>{intelligence.trust.map(item => <li key={item}>{item}</li>)}</ul>
      </details>
    </section>
  )
}
