'use client'

import { useMemo, useState } from 'react'
import { buildRoleEntityIntelligenceV35 } from '@/lib/entity-intelligence/role-intelligence-v35'
import { entityByIdV35 } from '@/lib/entity-intelligence/registry-v35'
import {
  clearApprovedSearchIntelligenceV35,
  setApprovedSearchEntityV35,
} from '@/lib/entity-intelligence/search-approval-v35'
import {
  clearSearchIntelligenceActivityEventV35,
  searchIntelligenceActivityEventV35,
} from '@/lib/entity-intelligence/search-approval-events-v35'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

function label(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

export function RoleEntityIntelligenceV35({ roleId }: { roleId: string }) {
  const { roles, updateRole } = useRoleWorkspaces()
  const [changeStatus, setChangeStatus] = useState('')
  const role = useMemo(() => roles.find(item => item.id === roleId), [roleId, roles])
  const intelligence = useMemo(
    () => role ? buildRoleEntityIntelligenceV35(role.intake, role.searchIntelligence) : null,
    [role],
  )

  if (!role || !intelligence) return null

  const location = intelligence.location
  const expansions = intelligence.suggestedExpansions.slice(0, 16)
  const approvedCount = intelligence.approvedExpansionIds.length
  const approvedEntities = intelligence.approvedExpansionIds
    .map(id => entityByIdV35(id))
    .filter((entity): entity is NonNullable<typeof entity> => Boolean(entity))

  function setApproval(entityId: string, entityLabel: string, approved: boolean) {
    const now = new Date()
    const event = searchIntelligenceActivityEventV35(entityId, entityLabel, approved, now)
    updateRole(roleId, current => ({
      ...current,
      searchIntelligence: setApprovedSearchEntityV35(current.searchIntelligence, entityId, approved, now),
      activity: [...current.activity, event].slice(-10000),
      updatedAt: now.toISOString(),
    }))
    setChangeStatus(approved
      ? `${entityLabel} added to Active Search Expansion. It will affect the next sourcing pass only; Role Brief requirements are unchanged.`
      : `${entityLabel} removed from Active Search Expansion. Role Brief requirements are unchanged.`)
  }

  function clearApprovals() {
    if (!approvedCount) return
    const now = new Date()
    const event = clearSearchIntelligenceActivityEventV35(now)
    updateRole(roleId, current => ({
      ...current,
      searchIntelligence: clearApprovedSearchIntelligenceV35(),
      activity: [...current.activity, event].slice(-10000),
      updatedAt: now.toISOString(),
    }))
    setChangeStatus('Cleared Active Search Expansion. The approved Role Brief and exact-title lane are unchanged.')
  }

  const locationLabel = [
    location.anchorLabel || role.intake.location || 'Not resolved',
    ...intelligence.explicitLocationAlternatives,
  ].filter(Boolean).join(' + ')

  return (
    <section className="role-entity-intel-v35" aria-label="Role entity intelligence">
      <div className="role-entity-intel-v35__header">
        <div>
          <div className="eyebrow">V36.7 entity intelligence</div>
          <h2>What SourcingOS understands</h2>
          <p>Normalized recruiter intent and recruiter-controlled discovery expansion. Approved suggestions affect future sourcing passes, never candidate evidence.</p>
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
          <strong>{locationLabel}</strong>
          <small>{label(location.mode)}{location.radiusMiles ? ` · ${location.radiusMiles} miles` : ''}{intelligence.explicitLocationAlternatives.length ? ' · recruiter-stated alternate market' : ''}</small>
        </article>
      </div>

      {changeStatus && <div className="role-entity-intel-v35__approved-note" role="status">{changeStatus}</div>}

      {approvedEntities.length > 0 && (
        <div className="role-entity-intel-v35__section" aria-label="Active Search Expansion">
          <div className="role-entity-intel-v35__section-title">
            <span>Active Search Expansion</span>
            <button type="button" className="role-entity-intel-v35__clear" onClick={clearApprovals}>Clear all</button>
          </div>
          <p className="role-entity-intel-v35__hint">These recruiter-approved terms are active for the next sourcing pass. They are discovery controls, not must-haves and not candidate facts.</p>
          <div className="role-entity-intel-v35__chips">
            {approvedEntities.map(entity => (
              <button
                type="button"
                key={`active:${entity.id}`}
                className="role-entity-intel-v35__chip role-entity-intel-v35__chip--button is-active"
                onClick={() => setApproval(entity.id, entity.canonicalLabel, false)}
                aria-label={`Remove ${entity.canonicalLabel} from Active Search Expansion`}
                title="Remove from the next sourcing pass"
              >
                ✓ {entity.canonicalLabel}<em>Active · click to remove</em>
              </button>
            ))}
          </div>
        </div>
      )}

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
          <div className="role-entity-intel-v35__section-title">
            <span>Find similar / broaden search</span>
            {approvedCount > 0 && <span>{approvedCount} active above</span>}
          </div>
          <p className="role-entity-intel-v35__hint">Click + to add a discovery adjacency. The chip will immediately appear in Active Search Expansion above and will be sent to the next sourcing pass.</p>
          <div className="role-entity-intel-v35__chips">
            {expansions.map(item => {
              const active = item.activation === 'suggested_active'
              return (
                <button
                  type="button"
                  key={`${item.entity.id}:${item.relationship?.id || item.matchType}`}
                  className={`role-entity-intel-v35__chip role-entity-intel-v35__chip--button${active ? ' is-active' : ''}`}
                  onClick={() => setApproval(item.entity.id, item.entity.canonicalLabel, !active)}
                  aria-pressed={active}
                  title={item.explanation}
                >
                  {active ? '✓ ' : '+ '}{item.entity.canonicalLabel}
                  <em>{active ? 'Active · ' : 'Add · '}{item.relationship ? label(item.relationship.type) : label(item.matchType)}</em>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {location.ambiguousCandidateIds?.length ? (
        <div className="role-entity-intel-v35__warning">Location is ambiguous. SourcingOS did not silently choose one interpretation.</div>
      ) : null}

      <details className="role-entity-intel-v35__trust">
        <summary>Why these suggestions are safe</summary>
        <ul>{intelligence.trust.map(item => <li key={item}>{item}</li>)}</ul>
      </details>
    </section>
  )
}
