'use client'
import { useState } from 'react'

export function JobSubmitForm() {
  const [form, setForm] = useState({ email: '', companyName: '', jobTitle: '', jobUrl: '', salaryRange: '', location: '', remoteType: 'Remote', notes: '' })
  const [status, setStatus] = useState('')
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('Submitting for review...')
    const res = await fetch('/api/jobs/submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) })
    const json = await res.json()
    setStatus(json.ok ? 'Submitted. This role is now in the SourcingOS review queue.' : json.error || 'Submission failed')
  }
  function update(key: keyof typeof form, value: string) { setForm(prev => ({ ...prev, [key]: value })) }
  return <form className="card" onSubmit={submit}>
    <label>Work email</label><input className="input" type="email" required value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@company.com" />
    <label>Job title</label><input className="input" required value={form.jobTitle} onChange={e => update('jobTitle', e.target.value)} placeholder="Senior Technical Sourcer" />
    <label>Company</label><input className="input" required value={form.companyName} onChange={e => update('companyName', e.target.value)} placeholder="Company name" />
    <label>Apply URL</label><input className="input" required value={form.jobUrl} onChange={e => update('jobUrl', e.target.value)} placeholder="https://company.com/careers/job" />
    <label>Location</label><input className="input" value={form.location} onChange={e => update('location', e.target.value)} placeholder="Remote, United States" />
    <label>Remote type</label><select className="input" value={form.remoteType} onChange={e => update('remoteType', e.target.value)}><option>Remote</option><option>Hybrid</option><option>Onsite</option></select>
    <label>Salary range</label><input className="input" value={form.salaryRange} onChange={e => update('salaryRange', e.target.value)} placeholder="$120k-$160k or $70-$95/hr" />
    <label>Notes</label><textarea className="textarea" value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Sourcing-heavy details, ATS, clearance/healthcare/AI focus, deadline, special requirements..." />
    <button className="btn" type="submit">Submit for review</button>
    {status ? <div className="cta">{status}</div> : null}
  </form>
}
