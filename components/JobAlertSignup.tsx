'use client'

import { FormEvent, useState } from 'react'
import { trackClientEvent } from '@/lib/analytics'

type Props = {
  category: string
  categoryName: string
  query: string
  location?: string
}

export function JobAlertSignup({ category, categoryName, query, location = '' }: Props) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email.trim() || status === 'saving') return

    setStatus('saving')
    setMessage('')
    trackClientEvent('job_alert_submit', categoryName, { source: category })

    try {
      const response = await fetch('/api/jobs/alerts/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          query,
          location,
          category,
          frequency: 'weekly',
        }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok || !payload?.ok) {
        setStatus('error')
        setMessage(payload?.error || 'We could not save your email just now. Please try again.')
        return
      }

      setStatus('saved')
      setMessage('You’re on the list. We’ll let you know when weekly alerts for this category go live.')
      trackClientEvent('job_alert_confirmed', categoryName, { source: category })
    } catch {
      setStatus('error')
      setMessage('We could not save your email just now. Please try again.')
    }
  }

  return (
    <div className="card featured">
      <span className="kicker">Recruiter job alerts</span>
      <h2>Join the {categoryName.toLowerCase()} alert list.</h2>
      <p className="muted">
        We’re building a weekly digest of new roles from original employer and public sources. Add your email to be first when this category goes live.
      </p>
      {status === 'saved' ? (
        <p className="cta" role="status">{message}</p>
      ) : (
        <form onSubmit={submit}>
          <label htmlFor={`job-alert-${category}`}>Email</label>
          <div className="button-row">
            <input
              id={`job-alert-${category}`}
              className="input"
              type="email"
              autoComplete="email"
              required
              maxLength={200}
              placeholder="you@example.com"
              value={email}
              onChange={event => setEmail(event.target.value)}
            />
            <button className="btn" type="submit" disabled={status === 'saving'}>
              {status === 'saving' ? 'Saving…' : 'Join alert list'}
            </button>
          </div>
          <small className="muted">Weekly at most. No auto-outreach. Unsubscribe anytime once emails begin.</small>
          {status === 'error' ? <p className="muted" role="alert">{message}</p> : null}
        </form>
      )}
    </div>
  )
}
