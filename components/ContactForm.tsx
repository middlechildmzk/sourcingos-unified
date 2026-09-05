'use client'

import { FormEvent, useState } from 'react'

type ContactCategory = 'privacy' | 'security' | 'candidate_data' | 'general'

const categoryCopy: Record<ContactCategory, { label: string; help: string }> = {
  privacy: {
    label: 'Privacy or data request',
    help: 'Access, correction, deletion, or questions about how SourcingOS handles data.',
  },
  security: {
    label: 'Security vulnerability',
    help: 'Report a suspected vulnerability privately. Do not include passwords, API keys, or unnecessary personal data.',
  },
  candidate_data: {
    label: 'Candidate-data concern or removal',
    help: 'Use this if you believe a candidate profile, resume, public-source record, or evidence item should be corrected or removed.',
  },
  general: {
    label: 'General or product question',
    help: 'Product feedback, beta questions, or other requests.',
  },
}

export default function ContactForm() {
  const [category, setCategory] = useState<ContactCategory>('general')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [candidateReference, setCandidateReference] = useState('')
  const [message, setMessage] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState('sending')
    setStatusMessage('')

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          category,
          email,
          subject: subject || undefined,
          candidate_reference: candidateReference || undefined,
          message,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'Unable to submit request.')

      setState('sent')
      setStatusMessage(payload?.message || 'Request received.')
      setSubject('')
      setCandidateReference('')
      setMessage('')
    } catch (error) {
      setState('error')
      setStatusMessage(error instanceof Error ? error.message : 'Unable to submit request.')
    }
  }

  const showCandidateReference = category === 'candidate_data' || category === 'privacy'

  return (
    <form onSubmit={submit} className="card" style={{ display: 'grid', gap: 14 }}>
      <div>
        <label htmlFor="contact-category">Request type</label>
        <select
          id="contact-category"
          className="input"
          value={category}
          onChange={(event) => setCategory(event.target.value as ContactCategory)}
        >
          {Object.entries(categoryCopy).map(([value, copy]) => (
            <option key={value} value={value}>{copy.label}</option>
          ))}
        </select>
        <p className="muted" style={{ marginTop: 6 }}>{categoryCopy[category].help}</p>
      </div>

      <div>
        <label htmlFor="contact-email">Your email</label>
        <input
          id="contact-email"
          className="input"
          type="email"
          autoComplete="email"
          required
          maxLength={320}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div>
        <label htmlFor="contact-subject">Subject <span className="muted">(optional)</span></label>
        <input
          id="contact-subject"
          className="input"
          maxLength={160}
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
        />
      </div>

      {showCandidateReference ? (
        <div>
          <label htmlFor="candidate-reference">Candidate/profile reference <span className="muted">(optional)</span></label>
          <input
            id="candidate-reference"
            className="input"
            maxLength={500}
            placeholder="Profile URL, candidate ID, or enough detail to locate the record"
            value={candidateReference}
            onChange={(event) => setCandidateReference(event.target.value)}
          />
          <p className="muted" style={{ marginTop: 6 }}>Share only what is needed to identify the record. We may ask for additional verification before deleting or disclosing personal data.</p>
        </div>
      ) : null}

      <div>
        <label htmlFor="contact-message">Message</label>
        <textarea
          id="contact-message"
          className="input"
          rows={7}
          required
          minLength={10}
          maxLength={5000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </div>

      <div className="button-row">
        <button className="btn" type="submit" disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending…' : 'Send securely'}
        </button>
      </div>

      {statusMessage ? (
        <p role="status" className={state === 'error' ? 'muted' : undefined}>{statusMessage}</p>
      ) : null}
    </form>
  )
}
