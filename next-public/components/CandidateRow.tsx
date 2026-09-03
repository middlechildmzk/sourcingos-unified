'use client'

export type CandidateRowPerson = {
  provider: string
  providerPersonId: string
  displayName: string
  headline?: string
  currentTitle?: string
  currentEmployer?: string
  location?: string
  skills?: string[]
  contactAvailability?: { email: boolean | 'unknown'; phone: boolean | 'unknown' }
  profileUrls?: Array<{ kind: string; url: string }>
}

function label(value: string) {
  return value.split('_').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ')
}

function contactState(value: boolean | 'unknown' | undefined) {
  if (value === true) return { text: 'Available', className: 'is-supported' }
  if (value === false) return { text: 'Not returned', className: 'is-muted' }
  return { text: 'Unknown', className: 'is-unknown' }
}

export function CandidateRow({
  person,
  rank,
  selected,
  why,
  evidenceCount,
  onSelect,
}: {
  person: CandidateRowPerson
  rank: number
  selected: boolean
  why?: string
  evidenceCount?: number
  onSelect: () => void
}) {
  const email = contactState(person.contactAvailability?.email)
  const phone = contactState(person.contactAvailability?.phone)
  return <button type="button" className={`candidate-row ${selected ? 'is-selected' : ''}`} onClick={onSelect} aria-pressed={selected}>
    <span className="candidate-row-rank">{rank}</span>
    <span className="candidate-row-main">
      <span className="candidate-row-name-line">
        <strong>{person.displayName}</strong>
        <span className="candidate-source">{label(person.provider)}</span>
      </span>
      <span className="candidate-row-role">{[person.currentTitle || person.headline, person.currentEmployer].filter(Boolean).join(' · ') || 'Professional profile'}</span>
      <span className="candidate-row-location">{person.location || 'Location not evidenced'}</span>
      {!!person.skills?.length && <span className="candidate-row-skills">{person.skills.slice(0, 5).map(skill => <span key={skill}>{skill}</span>)}</span>}
      <span className="candidate-row-why"><b>Why surfaced</b>{why || 'Candidate-like evidence from an executed source.'}</span>
    </span>
    <span className="candidate-row-side">
      <span className="candidate-evidence-count">{typeof evidenceCount === 'number' ? `${evidenceCount} supported` : 'Evidence open'}</span>
      <span className={`candidate-contact-state ${email.className}`}>Email {email.text}</span>
      <span className={`candidate-contact-state ${phone.className}`}>Phone {phone.text}</span>
      <span className="candidate-open-label">Open →</span>
    </span>
  </button>
}
