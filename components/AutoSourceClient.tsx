'use client'

import { useEffect, useMemo, useState } from 'react'

type RoleProject = {
  id: string
  title: string
  location: string
  clearance: string
  mustHaves: string[]
  niceToHaves: string[]
  raw: string
  createdAt: string
}

const STORAGE_KEY = 'sourcingos.autosource.roles.v15_1'

function splitJds(text: string) {
  return text
    .split(/\n\s*(?:---|###|JOB DESCRIPTION|Job Description|REQ:|Role:)\s*\n/gi)
    .map(part => part.trim())
    .filter(part => part.length > 80)
}

function uniq(items: string[]) {
  return Array.from(new Set(items.map(item => item.trim()).filter(Boolean))).slice(0, 12)
}

function parseRole(raw: string, index: number): RoleProject {
  const lines = raw.split('\n').map(line => line.trim()).filter(Boolean)
  const titleLine = lines.find(line => /engineer|developer|architect|analyst|manager|sourcer|recruiter|administrator|specialist|consultant/i.test(line)) || lines[0] || `Role ${index + 1}`
  const locationMatch = raw.match(/(?:location|hybrid|onsite|remote)[:\- ]+([^\n]+)/i)
  const clearance = raw.match(/TS\/SCI|Top Secret|Secret|Public Trust|CI Poly|Full Scope Poly/gi)
  const skillTerms = ['React', 'TypeScript', 'JavaScript', 'Next.js', 'Node', 'Python', 'Java', 'AWS', 'Azure', 'GCP', 'Kubernetes', 'Docker', 'Terraform', 'Jenkins', 'GitLab', 'DevSecOps', 'Cybersecurity', 'Linux', 'PostgreSQL', 'FastAPI', 'Spring', 'C#', '.NET']
  const foundSkills = skillTerms.filter(skill => raw.toLowerCase().includes(skill.toLowerCase()))
  const nice = ['Agile', 'Scrum', 'CI/CD', 'automation', 'microservices', 'cloud', 'security'].filter(skill => raw.toLowerCase().includes(skill.toLowerCase()))

  return {
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    title: titleLine.replace(/^title[:\- ]*/i, '').slice(0, 90),
    location: locationMatch?.[1]?.slice(0, 80) || 'Not specified',
    clearance: clearance ? uniq(clearance).join(', ') : 'Not specified',
    mustHaves: uniq(foundSkills),
    niceToHaves: uniq(nice),
    raw,
    createdAt: new Date().toISOString(),
  }
}

function buildSearches(role: RoleProject) {
  const skills = role.mustHaves.slice(0, 5).join(' ')
  const clearance = role.clearance !== 'Not specified' ? role.clearance : ''
  const query = [role.title, skills, clearance].filter(Boolean).join(' ')
  const encoded = encodeURIComponent(query)
  return [
    { label: 'Google X-Ray', href: `https://www.google.com/search?q=${encodeURIComponent(`site:linkedin.com/in ${query}`)}` },
    { label: 'GitHub', href: `https://github.com/search?q=${encoded}&type=users` },
    { label: 'Indeed', href: `https://www.indeed.com/resumes?q=${encoded}` },
    { label: 'Boolean Builder', href: `/tools/boolean-generator` },
    { label: 'JD Search Strategy', href: `/tools/jd-search-strategy` },
  ]
}

export function AutoSourceClient() {
  const [roles, setRoles] = useState<RoleProject[]>([])
  const [text, setText] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setRoles(JSON.parse(saved))
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(roles)) } catch {}
  }, [roles])

  const selected = useMemo(() => roles.find(role => role.id === selectedId) || roles[0], [roles, selectedId])

  function createProjects() {
    const parts = splitJds(text)
    const created = (parts.length ? parts : [text]).filter(part => part.trim().length > 80).map(parseRole)
    if (!created.length) return
    setRoles(prev => [...created, ...prev])
    setSelectedId(created[0].id)
    setText('')
  }

  return (
    <section style={{ display: 'grid', gap: 20 }}>
      <div className="card">
        <h1>AutoSource Agent</h1>
        <p className="muted">Paste multiple JDs, split them into role projects, generate sourcing lanes, and start calibration manually. Local-first V15.1 foundation.</p>
        <textarea
          value={text}
          onChange={event => setText(event.target.value)}
          placeholder="Paste 1–10 job descriptions here. Separate jobs with --- for best results."
          style={{ width: '100%', minHeight: 180, marginTop: 12 }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button onClick={createProjects}>Create role projects</button>
          <button type="button" onClick={() => setText('Cleared DevSecOps Engineer\nLocation: Northern Virginia\nClearance: TS/SCI\nMust have AWS, Kubernetes, Terraform, CI/CD, Linux.\n---\nSenior Java Developer\nLocation: Remote\nMust have Java, Spring, PostgreSQL, AWS, microservices.\n---\nCloud Security Engineer\nLocation: Hybrid\nMust have AWS, cybersecurity, Terraform, Kubernetes, automation.')}>Load demo req load</button>
          {roles.length > 0 && <button type="button" onClick={() => { if (confirm('Clear all AutoSource roles?')) setRoles([]) }}>Clear roles</button>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: roles.length ? 'minmax(220px, 320px) 1fr' : '1fr', gap: 16 }}>
        {roles.length > 0 && (
          <aside className="card" style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
            <h2>Role projects</h2>
            {roles.map(role => (
              <button key={role.id} onClick={() => setSelectedId(role.id)} style={{ textAlign: 'left' }}>
                <strong>{role.title}</strong><br />
                <span className="muted">{role.location}</span>
              </button>
            ))}
          </aside>
        )}

        {selected ? (
          <main className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
              <div>
                <h2>{selected.title}</h2>
                <p className="muted">{selected.location} · Clearance: {selected.clearance}</p>
              </div>
              <button onClick={() => setRoles(prev => prev.filter(role => role.id !== selected.id))}>Delete</button>
            </div>

            <h3>Parsed requirements</h3>
            <p><strong>Must-haves:</strong> {selected.mustHaves.length ? selected.mustHaves.join(', ') : 'Review JD manually'}</p>
            <p><strong>Nice-to-haves:</strong> {selected.niceToHaves.length ? selected.niceToHaves.join(', ') : 'Not detected yet'}</p>

            <h3>Search lanes</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {buildSearches(selected).map(link => (
                <a key={link.label} className="button" href={link.href} target={link.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{link.label}</a>
              ))}
            </div>

            <h3>Calibration note</h3>
            <p className="muted">Capture the first 5 candidates manually, mark strong fit/maybe/bad fit, then use those patterns to refine search strings in V15.1.1.</p>
          </main>
        ) : (
          <div className="card">
            <h2>No active roles yet</h2>
            <p className="muted">Paste a req load above to create your first AutoSource projects.</p>
          </div>
        )}
      </div>
    </section>
  )
}
