'use client'

import { useMemo } from 'react'
import { buildRoleEntityIntelligenceV35 } from '@/lib/entity-intelligence/role-intelligence-v35'
import {
  clearApprovedSearchIntelligenceV35,
  setApprovedSearchEntityV35,
} from '@/lib/entity-intelligence/search-approval-v35'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

function label(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

export function RoleEntityIntelligenceV35({ roleId }: { roleId: string }) {
  const { roles, updateRole } = useRoleWorkspaces()
  const role = useMemo(() => roles.find(item => item.id === roleId), [roleId, roles])
  const intelligence = useMemo(
    () => role ? buildRoleEntityIntelligenceV35(role.intake, role.searchIntelligence) : null,
    [role],
  )

  if (!role || !intelligence) return null

  const location = intelligence.location
  const expansions = intelligence.suggestedExpansions.slice(0, 16)
  const approvedCount = intelligence.approvedExpansionIds.length

  function setApproval(entityId: string, entityLabel: string, approved: boolean) {
    const now = new Date()
    updateRole(roleId, current => ({
      ...current,
      searchIntelligence: setApprovedSearchEntityV35(current.searchIntelligence, entityId, approved, now),
      activity: [
        ...current.activity,
        {
          id: crypto.randomUUID(),
          type: 'search_intelligence_updated',
          message: `${approved ? 'Approved' : 'Removed'} search expansion: ${entityLabel}. This changes retrieval only, not role requirements.`,
          createdAt: now.toISOString(),
        },
      ].slice(-10000),
      updatedAt: now.toISOString(),
    }))
  }

  function clearApprovals() {
    if (!approvedCount) return
    const now = new Date()
    updateRole(roleId, current => ({
      ...current,
      searchIntelligence: clearApprovedSearchIntelligenceV35(),
      activity: [
        ...current.activity,
        {
          id: crypto.randomUUID(),
          type: 'search_intelligence_updated',
          message: 'Cleared recruiter-approved search expansions. Approved Role Brief criteria were unchanged.',
          createdAt: now.toISOString(),
        },
      ].slice(-10000),
      updatedAt: now.toISOString(),
    }))
  }

  return (
    <section className="role-entity-intel-v35" aria-label="Role entity intelligence">
      <div className="role-entity-intel-v35__header">
        <div>
          <div className="eyebrow">V35 entity intelligence</div>
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
          <div className="role-entity-intel-v35__section-title">
            <span>Find similar / broaden search</span>
            {approvedCount > 0 && <button type="button" className="role-entity-intel-v35__clear" onClick={clearApprovals}>Clear {approvedCount} approved</button>}
          </div>
          <p className="role-entity-intel-v35__hint">Select only the adjacencies you want SourcingOS to use in future retrieval. The exact-title lane and approved Role Brief stay unchanged.</p>
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
                  <em>{active ? 'Approved · ' : ''}{item.relationship ? label(item.relationship.type) : label(item.matchType)}</em>
                </button>
              )
            })}
          </div>
          {approvedCount > 0 && (
            <div className="role-entity-intel-v35__approved-note">
              {approvedCount} recruiter-approved expansion{approvedCount === 1 ? '' : 's'} will be applied to adjacent/capability/company/location retrieval on the next sourcing pass.
            </div>
          )}
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
