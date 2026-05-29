'use client'
import { useMemo, useState } from 'react'
import { trackClientEvent } from '@/lib/analytics'

const sources = [
  ['LinkedIn profiles', 'site:linkedin.com/in'],
  ['GitHub', 'site:github.com'],
  ['Public resumes', '(filetype:pdf OR intitle:resume OR inurl:resume)'],
  ['Stack Overflow', 'site:stackoverflow.com/users'],
  ['Hugging Face', 'site:huggingface.co'],
  ['OpenAlex', 'site:openalex.org/authors']
] as const

export function XrayTool() {
  const [source, setSource] = useState<string>(sources[1][1])
  const [terms, setTerms] = useState('Kubernetes Terraform Platform Engineer')
  const [location, setLocation] = useState('Remote OR United States')
  const [exclude, setExclude] = useState('jobs hiring course tutorial bootcamp')

  const query = useMemo(() => {
    const termGroup = terms
      .split(/[,
]+/)
      .map(term => term.trim())
      .filter(Boolean)
      .join(' OR ')
    const exclusions = exclude
      .split(/\s+/)
      .map(item => item.trim())
      .filter(Boolean)
      .map(item => `-${item}`)
      .join(' ')
    return `${source} (${termGroup}) (${location}) ${exclusions}`
  }, [source, terms, location, exclude])

  return <div className="interactive-tool">
    <p className="muted">X-Ray search uses Google operators to search public profile surfaces. Use it for research and evidence discovery, not automated scraping.</p>
    <label>Source</label>
    <select className="input" value={source} onChange={e => setSource(e.target.value)}>
      {sources.map(s => <option key={s[0]} value={s[1]}>{s[0]}</option>)}
    </select>
    <label>Skill / title signals</label>
    <textarea className="textarea" value={terms} onChange={e => setTerms(e.target.value)} />
    <label>Location / context</label>
    <input className="input" value={location} onChange={e => setLocation(e.target.value)} />
    <label>Exclude</label>
    <input className="input" value={exclude} onChange={e => setExclude(e.target.value)} />
    <div className="result-card">
      <pre>{query}</pre>
      <div className="button-row">
        <button onClick={() => { navigator.clipboard?.writeText(query); trackClientEvent('copy_xray') }}>Copy</button>
        <button onClick={() => { trackClientEvent('launch_xray', 'google'); window.open('https://www.google.com/search?q=' + encodeURIComponent(query), '_blank') }}>Open Google</button>
      </div>
    </div>
  </div>
}
