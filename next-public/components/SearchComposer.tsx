'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ALL_TAXONOMY, EntityType, TaxonomyEntry } from '@/data/search-taxonomy'
import { ALL_SOURCE_LANES, EXPANSIONS, SOURCE_LANES_BY_ENTITY } from '@/data/search-expansions'
import { SearchAssistDropdown } from '@/components/SearchAssistDropdown'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecognizedChip {
  id: string
  canonical: string
  display: string
  type: EntityType
  color: string
  locked: boolean
}

export interface ComposerOutput {
  rawQuery: string
  chips: RecognizedChip[]
  booleanString: string
  xRayString: string
  githubQuery: string
  openAlexQuery: string
  npmQuery: string
  recommendedSourceIds: string[]
  candidateScorecardHints: string[]
  verifyNextItems: string[]
  falsePosWarnings: string[]
}

interface SearchComposerProps {
  onOutput?: (output: ComposerOutput) => void
  onSearch?: (output: ComposerOutput) => void
  initialQuery?: string
  compact?: boolean
  /** Programmatic append from AI Copilot Apply actions. Bump nonce to trigger. */
  externalAppend?: { terms: string[]; nonce: number }
}

// ─── Sample searches ──────────────────────────────────────────────────────────

const SAMPLE_SEARCHES = [
  // Skill-first (best for live source results)
  { label: 'React TypeScript Next.js',          query: 'React TypeScript Next.js frontend' },
  { label: 'Kubernetes Terraform AWS platform', query: 'Kubernetes Terraform AWS platform engineer' },
  { label: 'PyTorch Hugging Face LLM',          query: 'PyTorch Hugging Face LLM NLP' },
  { label: 'Python FastAPI PostgreSQL',         query: 'Python FastAPI PostgreSQL backend' },
  // Cleared (clearance strips automatically, skills drive live search)
  { label: 'DevSecOps Kubernetes TS/SCI',       query: 'DevSecOps Kubernetes Terraform TS/SCI Northern Virginia' },
  { label: 'Splunk SIEM cyber DC',              query: 'Cybersecurity Splunk SIEM Secret clearance DC' },
  // Healthcare
  { label: 'Epic Azure healthcare data',        query: 'Epic Azure healthcare data engineer Minnesota' },
  // AI/ML
  { label: 'MLOps Kubernetes Python',           query: 'MLOps Kubernetes Python AWS' },
]

// ─── Entity recognition engine ────────────────────────────────────────────────

function recognizeEntities(query: string): RecognizedChip[] {
  const lower = query.toLowerCase()
  const chips: RecognizedChip[] = []
  // Track which character positions are consumed to avoid double-matching
  const consumed = new Uint8Array(lower.length)

  for (const entry of ALL_TAXONOMY) {
    for (const alias of entry.aliases) {
      let idx = lower.indexOf(alias)
      while (idx !== -1) {
        // Check if any character in this range is already consumed
        const alreadyUsed = consumed.slice(idx, idx + alias.length).some(v => v === 1)
        if (!alreadyUsed) {
          // Mark consumed
          consumed.fill(1, idx, idx + alias.length)
          chips.push({
            id: `${entry.canonical}-${idx}`,
            canonical: entry.canonical,
            display: entry.canonical,
            type: entry.type,
            color: entry.color,
            locked: false,
          })
          break // only match once per alias
        }
        idx = lower.indexOf(alias, idx + 1)
      }
    }
  }

  // Deduplicate by canonical name (keep first occurrence)
  const seen = new Set<string>()
  return chips.filter(c => {
    if (seen.has(c.canonical)) return false
    seen.add(c.canonical)
    return true
  })
}

// ─── Search output generators ─────────────────────────────────────────────────

function buildBoolean(chips: RecognizedChip[], location: string): string {
  const titleTerms = chips.filter(c => c.type === 'title')
  const skillTerms = chips.filter(c => c.type === 'skill' || c.type === 'tool')
  const clearanceTerms = chips.filter(c => c.type === 'clearance')
  const certTerms = chips.filter(c => c.type === 'certification')
  const locationTerms = chips.filter(c => c.type === 'location')

  const parts: string[] = []

  if (titleTerms.length > 0) {
    const alts = titleTerms.flatMap(c => {
      const exps = EXPANSIONS[c.canonical.toLowerCase()] || []
      return [c.canonical, ...exps.slice(0, 3)]
    })
    const unique = [...new Set(alts)]
    parts.push(`(${unique.map(t => `"${t}"`).join(' OR ')})`)
  }

  if (skillTerms.length > 0) {
    skillTerms.forEach(c => {
      const exps = EXPANSIONS[c.canonical.toLowerCase()] || []
      const terms = [c.canonical, ...exps.slice(0, 2)]
      const unique = [...new Set(terms)]
      parts.push(unique.length > 1
        ? `(${unique.map(t => `"${t}"`).join(' OR ')})`
        : `"${c.canonical}"`)
    })
  }

  if (clearanceTerms.length > 0) {
    const clearTerms = clearanceTerms.flatMap(c => {
      const exps = EXPANSIONS[c.canonical.toLowerCase()] || []
      return [c.canonical, ...exps.slice(0, 2)]
    })
    parts.push(`(${[...new Set(clearTerms)].map(t => `"${t}"`).join(' OR ')})`)
  }

  if (certTerms.length > 0) {
    parts.push(...certTerms.map(c => `"${c.canonical}"`))
  }

  if (locationTerms.length > 0) {
    const locTerms = locationTerms.flatMap(c => {
      const exps = EXPANSIONS[c.canonical.toLowerCase()] || []
      return [c.canonical, ...exps.slice(0, 3)]
    })
    parts.push(`(${[...new Set(locTerms)].map(t => `"${t}"`).join(' OR ')})`)
  } else if (location) {
    parts.push(`"${location}"`)
  }

  return parts.join(' AND ') || '—'
}

function buildXRay(chips: RecognizedChip[], location: string): string {
  const titles = chips.filter(c => c.type === 'title').map(c => `"${c.canonical}"`).join(' OR ')
  const skills = chips.filter(c => c.type === 'skill' || c.type === 'tool').map(c => `"${c.canonical}"`).join(' ')
  const clearances = chips.filter(c => c.type === 'clearance').map(c => `"${c.canonical}"`).join(' OR ')
  const locs = chips.filter(c => c.type === 'location').map(c => `"${c.canonical}"`).join(' OR ')

  let q = 'site:linkedin.com/in'
  if (titles) q += ` (${titles})`
  if (skills) q += ` ${skills}`
  if (clearances) q += ` (${clearances})`
  if (locs) q += ` (${locs})`
  else if (location) q += ` "${location}"`
  return q || '—'
}

function buildGithub(chips: RecognizedChip[], location: string): string {
  const terms = chips
    .filter(c => c.type === 'skill' || c.type === 'tool' || c.type === 'title')
    .map(c => c.canonical)
    .join(' ')
  const loc = chips.find(c => c.type === 'location')?.canonical || location
  let q = terms
  if (loc && loc.toLowerCase() !== 'remote') q += ` location:"${loc}"`
  return q.trim() || '—'
}

function buildOpenAlex(chips: RecognizedChip[]): string {
  return chips
    .filter(c => c.type === 'skill' || c.type === 'tool' || c.type === 'industry')
    .map(c => c.canonical)
    .join(' ') || '—'
}

function buildNpmQuery(chips: RecognizedChip[]): string {
  return chips
    .filter(c => c.type === 'skill' || c.type === 'tool')
    .map(c => c.canonical.toLowerCase())
    .join(' ') || '—'
}

function getRecommendedSources(chips: RecognizedChip[]): string[] {
  const scores: Record<string, number> = {}
  const add = (id: string, weight = 1) => { scores[id] = (scores[id] || 0) + weight }

  for (const chip of chips) {
    const isHealthcare = chip.type === 'industry' && chip.canonical.toLowerCase() === 'healthcare'
    const isGovCon = chip.type === 'industry' && chip.canonical.toLowerCase() === 'govcon'
    const isAI = chip.type === 'industry' && chip.canonical.toLowerCase() === 'ai/ml'
    const isClearance = chip.type === 'clearance'
    const isCyber = chip.canonical.toLowerCase().includes('cyber') || chip.canonical.toLowerCase().includes('security')

    if (isHealthcare) { add('npi', 3); add('pubmed', 2) }
    if (isGovCon || isClearance) { add('clearancejobs', 3); add('usajobs', 2) }
    if (isAI) { add('huggingface', 3); add('arxiv', 2); add('pypi', 2) }
    if (chip.type === 'skill' || chip.type === 'tool') {
      add('github', 2); add('stackoverflow', 1); add('npm', 1); add('pypi', 1)
    }
    if (chip.canonical === 'Python' || chip.canonical === 'PyTorch' || chip.canonical === 'TensorFlow') {
      add('pypi', 2)
    }
    if (chip.canonical === 'Rust') add('crates', 2)
    if (chip.canonical === 'Hugging Face') add('huggingface', 3)
    if (isCyber) add('github', 2)
    add('github', 1) // GitHub always baseline
  }

  if (Object.keys(scores).length === 0) {
    return ['github', 'openalex', 'npm']
  }

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id)
}

function getScorecardHints(chips: RecognizedChip[]): string[] {
  const hints: string[] = []
  const hasTitle = chips.some(c => c.type === 'title')
  const hasClearance = chips.some(c => c.type === 'clearance')
  const hasSkill = chips.some(c => c.type === 'skill' || c.type === 'tool')
  const hasLocation = chips.some(c => c.type === 'location')
  const hasHealthcare = chips.some(c => c.canonical.toLowerCase() === 'epic' || c.canonical.toLowerCase() === 'cerner')
  const hasAI = chips.some(c => ['pytorch', 'tensorflow', 'llm', 'nlp', 'hugging face'].includes(c.canonical.toLowerCase()))

  if (hasTitle) hints.push('Target title or adjacent title confirmed in resume/profile')
  if (hasClearance) hints.push('Clearance level mentioned in public profile (unverified — recruiter must confirm)')
  if (hasSkill) hints.push('Required skill or tool mentioned in public work/project evidence')
  if (hasLocation) hints.push('Location signal matches requirement (confirm remote eligibility if applicable)')
  if (hasHealthcare) hints.push('Healthcare EMR/EHR experience confirmed in profile evidence')
  if (hasAI) hints.push('AI/ML stack evidence present in public projects or publications')
  if (!hasTitle && !hasSkill) hints.push('No title or skill detected — add specifics for stronger signal')
  return hints
}

function getFalsePosWarnings(chips: RecognizedChip[]): string[] {
  const warns: string[] = []
  const hasClearance = chips.some(c => c.type === 'clearance')
  const hasHealthcare = chips.some(c => c.type === 'industry' && c.canonical === 'Healthcare')
  const hasEpic = chips.some(c => c.canonical === 'Epic')
  const hasNLP = chips.some(c => c.canonical === 'NLP')

  if (hasClearance) warns.push('Public clearance mentions are unverified breadcrumbs only. Do not treat as confirmed clearance status.')
  if (hasEpic) warns.push('"Epic" in a profile may refer to the word, not Epic Systems. Verify context.')
  if (hasNLP) warns.push('"NLP" may appear in non-ML contexts (neuro-linguistic programming, non-linear planning).')
  if (hasHealthcare) warns.push('Healthcare recruiter results may include clinical staff, not recruiters. Verify title context.')
  return warns
}

function getVerifyNext(chips: RecognizedChip[]): string[] {
  const items: string[] = []
  const hasClearance = chips.some(c => c.type === 'clearance')
  const hasHealthcare = chips.some(c => c.canonical === 'Epic' || c.canonical === 'Cerner')
  const hasAI = chips.some(c => ['pytorch', 'tensorflow', 'hugging face'].includes(c.canonical.toLowerCase()))
  const hasGovCon = chips.some(c => c.type === 'industry' && c.canonical === 'GovCon')

  if (hasClearance) items.push('Confirm clearance level and status directly with candidate — do not rely on public breadcrumbs')
  if (hasHealthcare) items.push('Confirm EMR version experience (Epic Ambulatory vs Inpatient vs Beaker)')
  if (hasAI) items.push('Confirm production ML experience vs academic/hobby project')
  if (hasGovCon) items.push('Confirm citizenship status required for clearance eligibility')
  items.push('Verify current employment status and open-to-work intent directly')
  items.push('Confirm location and remote/onsite preference before outreach')
  return items
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SearchComposer({ onOutput, onSearch, initialQuery = '', compact, externalAppend }: SearchComposerProps) {
  const [rawQuery, setRawQuery] = useState(initialQuery)
  const [chips, setChips] = useState<RecognizedChip[]>([])
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set())
  const [location, setLocation] = useState('')
  const [showOutputs, setShowOutputs] = useState(false)
  const [showImprovements, setShowImprovements] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [assistOpen, setAssistOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastAppendNonce = useRef<number>(0)

  // Append a term picked from the assist dropdown (space-delimited, dedup-safe).
  const addAssistTerm = useCallback((term: string) => {
    setRawQuery(prev => {
      const exists = ` ${prev.toLowerCase()} `.includes(` ${term.toLowerCase()} `)
      return exists ? prev : `${prev} ${term}`.trim()
    })
    inputRef.current?.focus()
  }, [])

  // Apply external terms (from AI Copilot) by appending any not already present
  useEffect(() => {
    if (!externalAppend || externalAppend.nonce === lastAppendNonce.current) return
    lastAppendNonce.current = externalAppend.nonce
    setRawQuery(prev => {
      const existing = prev.toLowerCase()
      const toAdd = externalAppend.terms.filter(t => t && !existing.includes(t.toLowerCase()))
      return toAdd.length ? `${prev} ${toAdd.join(' ')}`.trim() : prev
    })
  }, [externalAppend])

  // Debounced entity recognition
  useEffect(() => {
    const timer = setTimeout(() => {
      const recognized = recognizeEntities(rawQuery)
      // Preserve locked chips even when query changes
      const locked = chips.filter(c => lockedIds.has(c.id))
      const lockedCanonicals = new Set(locked.map(c => c.canonical))
      const newChips = recognized.filter(c => !lockedCanonicals.has(c.canonical))
      setChips([...locked, ...newChips])
    }, 200)
    return () => clearTimeout(timer)
  }, [rawQuery])

  // Build output whenever chips change
  const output: ComposerOutput = {
    rawQuery,
    chips,
    booleanString: buildBoolean(chips, location),
    xRayString: buildXRay(chips, location),
    githubQuery: buildGithub(chips, location),
    openAlexQuery: buildOpenAlex(chips),
    npmQuery: buildNpmQuery(chips),
    recommendedSourceIds: getRecommendedSources(chips),
    candidateScorecardHints: getScorecardHints(chips),
    verifyNextItems: getVerifyNext(chips),
    falsePosWarnings: getFalsePosWarnings(chips),
  }

  useEffect(() => {
    onOutput?.(output)
  }, [chips, rawQuery, location])

  const removeChip = (id: string) => {
    setChips(prev => prev.filter(c => c.id !== id))
    setLockedIds(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  const toggleLock = (id: string) => {
    setLockedIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text).catch(() => {})
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const loadSample = (query: string) => {
    setRawQuery(query)
    setChips([])
    setLockedIds(new Set())
    inputRef.current?.focus()
  }

  const recommendedLanes = ALL_SOURCE_LANES.filter(l => output.recommendedSourceIds.includes(l.id))
  const otherLanes = ALL_SOURCE_LANES.filter(l => !output.recommendedSourceIds.includes(l.id))

  return (
    <div className="composer">

      {/* ── Sample searches ────────────────────────────────────────── */}
      <div className="composer-samples">
        <span className="composer-samples-label">Try:</span>
        {SAMPLE_SEARCHES.map(s => (
          <button key={s.label} className="composer-sample-btn" onClick={() => loadSample(s.query)}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Main search input ─────────────────────────────────────── */}
      <div className="composer-input-row">
        <input
          ref={inputRef}
          className="composer-input"
          type="text"
          value={rawQuery}
          onChange={e => setRawQuery(e.target.value)}
          onFocus={() => setAssistOpen(true)}
          onBlur={() => setTimeout(() => setAssistOpen(false), 180)}
          placeholder="e.g. DevSecOps Kubernetes TS/SCI Northern Virginia — or try a sample above"
          onKeyDown={e => {
            if (e.key === 'Enter' && rawQuery.trim()) {
              onSearch?.(output)
            }
          }}
        />
        {!compact && (
          <input
            className="composer-location"
            type="text"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="Location override"
          />
        )}
        <button
          className="btn"
          style={{ flexShrink: 0 }}
          onClick={() => rawQuery.trim() && onSearch?.(output)}
        >
          Search →
        </button>
      </div>

      {/* ── Smart assist typeahead ────────────────────────────────── */}
      <SearchAssistDropdown
        query={rawQuery}
        onAddTerm={addAssistTerm}
        selectedLaneId={output.recommendedSourceIds[0]}
        open={assistOpen && rawQuery.trim().length >= 2}
        onRequestClose={() => setAssistOpen(false)}
      />

      {/* ── Recognized chips ─────────────────────────────────────── */}
      {chips.length > 0 && (
        <div className="composer-chips">
          {chips.map(chip => (
            <span
              key={chip.id}
              className={`composer-chip chip-${chip.color} ${lockedIds.has(chip.id) ? 'chip-locked' : ''}`}
              title={`${chip.type} — click to lock, × to remove`}
            >
              <span className="chip-type-label">{chip.type}</span>
              <span className="chip-value" onClick={() => toggleLock(chip.id)}>{chip.display}</span>
              {lockedIds.has(chip.id) && <span className="chip-lock-icon">◈</span>}
              <button className="chip-remove" onClick={() => removeChip(chip.id)} aria-label={`Remove ${chip.display}`}>×</button>
            </span>
          ))}
          {chips.length > 0 && (
            <button
              className="composer-sample-btn"
              onClick={() => { setChips([]); setLockedIds(new Set()) }}
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {chips.length === 0 && rawQuery.trim() && (
        <p className="muted" style={{ fontSize: '12px', margin: '8px 0 0' }}>
          No entities recognized yet. Try adding a title, skill, location, or clearance level.
        </p>
      )}

      {chips.length > 0 && (
        <>
          {/* ── Expansion suggestions ─────────────────────────────── */}
          <div className="composer-suggestions">
            <div className="composer-section-label">Suggested additions</div>
            <div className="composer-suggestion-groups">
              {chips.slice(0, 3).map(chip => {
                const exps = EXPANSIONS[chip.canonical.toLowerCase()] || []
                if (exps.length === 0) return null
                return (
                  <div key={chip.id} className="suggestion-group">
                    <span className="suggestion-group-label">{chip.display} →</span>
                    <div className="suggestion-tags">
                      {exps.slice(0, 5).map(exp => (
                        <button
                          key={exp}
                          className="suggestion-tag"
                          onClick={() => setRawQuery(q => q ? `${q} ${exp}` : exp)}
                        >
                          + {exp}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Action bar ────────────────────────────────────────── */}
          <div className="composer-action-bar">
            <button
              className="composer-toggle-btn"
              onClick={() => setShowOutputs(v => !v)}
            >
              {showOutputs ? '▾' : '▸'} Generated search strings
            </button>
            <button
              className="composer-toggle-btn"
              onClick={() => setShowImprovements(v => !v)}
            >
              {showImprovements ? '▾' : '▸'} Improve this search
            </button>
          </div>

          {/* ── Generated outputs ─────────────────────────────────── */}
          {showOutputs && (
            <div className="composer-outputs">
              <OutputRow label="Boolean" value={output.booleanString} onCopy={() => copyToClipboard(output.booleanString, 'bool')} copied={copied === 'bool'}
                href={output.booleanString !== '—' ? `https://www.google.com/search?q=${encodeURIComponent(output.booleanString)}` : undefined} />
              <OutputRow label="X-Ray (LinkedIn)" value={output.xRayString} onCopy={() => copyToClipboard(output.xRayString, 'xray')} copied={copied === 'xray'}
                href={output.xRayString !== '—' ? `https://www.google.com/search?q=${encodeURIComponent(output.xRayString)}` : undefined} />
              <OutputRow label="GitHub" value={output.githubQuery} onCopy={() => copyToClipboard(output.githubQuery, 'gh')} copied={copied === 'gh'}
                href={output.githubQuery !== '—' ? `https://github.com/search?q=${encodeURIComponent(output.githubQuery)}&type=users` : undefined} />
              <OutputRow label="OpenAlex" value={output.openAlexQuery} onCopy={() => copyToClipboard(output.openAlexQuery, 'oa')} copied={copied === 'oa'}
                href={output.openAlexQuery !== '—' ? `https://openalex.org/authors?search=${encodeURIComponent(output.openAlexQuery)}` : undefined} />
              <OutputRow label="npm / PyPI" value={output.npmQuery} onCopy={() => copyToClipboard(output.npmQuery, 'npm')} copied={copied === 'npm'}
                href={output.npmQuery !== '—' ? `https://www.npmjs.com/search?q=${encodeURIComponent(output.npmQuery)}` : undefined} />

              {output.falsePosWarnings.length > 0 && (
                <div className="output-warnings">
                  <div className="composer-section-label" style={{ color: 'var(--amber)', marginBottom: '8px' }}>Likely false positives</div>
                  {output.falsePosWarnings.map(w => <p key={w} className="muted" style={{ fontSize: '13px', margin: '4px 0' }}>⚠ {w}</p>)}
                </div>
              )}
            </div>
          )}

          {/* ── Improve this search ────────────────────────────────── */}
          {showImprovements && (
            <div className="composer-improvements">
              {output.candidateScorecardHints.length > 0 && (
                <div className="improvement-section">
                  <div className="composer-section-label">Candidate scorecard signals</div>
                  <ul className="verify-list" style={{ marginTop: '8px' }}>
                    {output.candidateScorecardHints.map(h => <li key={h}>{h}</li>)}
                  </ul>
                </div>
              )}
              {output.verifyNextItems.length > 0 && (
                <div className="improvement-section">
                  <div className="composer-section-label">Verify next (before outreach)</div>
                  <ul className="verify-list" style={{ marginTop: '8px' }}>
                    {output.verifyNextItems.map(v => <li key={v}>{v}</li>)}
                  </ul>
                </div>
              )}
              <div className="improvement-section">
                <div className="composer-section-label">Missing constraints</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {!chips.some(c => c.type === 'location') && (
                    <button className="suggestion-tag" onClick={() => setRawQuery(q => q + ' Remote')}>+ Location/remote</button>
                  )}
                  {!chips.some(c => c.type === 'seniority') && (
                    <button className="suggestion-tag" onClick={() => setRawQuery(q => q + ' Senior')}>+ Seniority level</button>
                  )}
                  {!chips.some(c => c.type === 'clearance') && chips.some(c => c.type === 'industry' && c.canonical === 'GovCon') && (
                    <button className="suggestion-tag" onClick={() => setRawQuery(q => q + ' TS/SCI')}>+ Clearance level</button>
                  )}
                  {!chips.some(c => c.type === 'skill' || c.type === 'tool') && (
                    <button className="suggestion-tag" onClick={() => inputRef.current?.focus()}>+ Technical skill</button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Source lane recommendations ─────────────────────────── */}
          <div className="composer-lanes">
            <div className="composer-section-label">Recommended source lanes</div>
            <div className="lanes-grid">
              {recommendedLanes.map(lane => (
                <LaneCard key={lane.id} lane={lane} query={output.rawQuery} recommended />
              ))}
              {!compact && otherLanes.slice(0, 6).map(lane => (
                <LaneCard key={lane.id} lane={lane} query={output.rawQuery} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OutputRow({ label, value, onCopy, copied, href }: {
  label: string; value: string; onCopy: () => void; copied: boolean; href?: string
}) {
  return (
    <div className="output-row">
      <span className="output-label">{label}</span>
      <code className="output-value">{value}</code>
      <div className="output-actions">
        <button className="output-btn" onClick={onCopy} disabled={value === '—'}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
        {href && (
          <a className="output-btn" href={href} target="_blank" rel="noreferrer noopener">
            Open →
          </a>
        )}
      </div>
    </div>
  )
}

function LaneCard({ lane, query, recommended }: { lane: typeof ALL_SOURCE_LANES[0]; query: string; recommended?: boolean }) {
  const statusCls = `status-${lane.status}`
  const openUrl = lane.url
    ? lane.url.replace('QUERY', encodeURIComponent(query))
    : undefined

  return (
    <div className={`lane-card ${recommended ? 'lane-recommended' : ''}`}>
      <div className="lane-head">
        <span className="lane-name">{lane.name}</span>
        <span className={statusCls}>{lane.status}</span>
      </div>
      <p className="lane-desc">{lane.description}</p>
      {openUrl && (
        <a className="kicker" href={openUrl} target="_blank" rel="noreferrer noopener" style={{ marginTop: '6px', display: 'inline-block' }}>
          Open →
        </a>
      )}
    </div>
  )
}
