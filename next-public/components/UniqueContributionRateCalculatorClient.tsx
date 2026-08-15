'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

type SourceRow = {
  id: number
  name: string
  reviewed: number
  unique: number
  cost: number
}

const seedRows: SourceRow[] = [
  { id: 1, name: 'Licensed platform', reviewed: 30, unique: 8, cost: 0 },
  { id: 2, name: 'Public web / X-Ray', reviewed: 20, unique: 9, cost: 0 },
  { id: 3, name: 'ATS rediscovery', reviewed: 15, unique: 11, cost: 0 },
  { id: 4, name: 'Donor-company lane', reviewed: 18, unique: 7, cost: 0 },
]

function pct(n: number) {
  return `${Math.round(n * 100)}%`
}

export function UniqueContributionRateCalculatorClient() {
  const [rows, setRows] = useState<SourceRow[]>(seedRows)

  const normalized = useMemo(() => rows.map(row => {
    const reviewed = Math.max(0, row.reviewed)
    const unique = Math.min(Math.max(0, row.unique), reviewed)
    const ucr = reviewed > 0 ? unique / reviewed : 0
    const costPerUnique = row.cost > 0 && unique > 0 ? row.cost / unique : null
    return { ...row, reviewed, unique, ucr, costPerUnique }
  }), [rows])

  function update(id: number, key: keyof Omit<SourceRow, 'id'>, value: string) {
    setRows(current => current.map(row => {
      if (row.id !== id) return row
      if (key === 'name') return { ...row, name: value }
      return { ...row, [key]: Math.max(0, Number(value) || 0) }
    }))
  }

  function addRow() {
    setRows(current => [...current, { id: Math.max(0, ...current.map(r => r.id)) + 1, name: 'New source', reviewed: 0, unique: 0, cost: 0 }])
  }

  function removeRow(id: number) {
    setRows(current => current.length > 1 ? current.filter(row => row.id !== id) : current)
  }

  return <div>
    <div className="preview-banner" style={{ marginBottom: 20 }}>
      <span className="pb-icon">◈</span>
      <span><strong>Comparison rule:</strong> use the same requisition, comparable review criteria, and capped effort per source. UCR measures additive discovery inside that comparison. It does not measure candidate quality, response rate, hires, or ROI by itself.</span>
    </div>

    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
        <thead>
          <tr>
            {['Source / lane', 'Reviewed candidates', 'Unique to this source', 'UCR', 'Optional cost', 'Cost / unique', ''].map(label => <th key={label} style={{ textAlign:'left', padding:'10px 8px', borderBottom:'1px solid var(--line)' }}>{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {normalized.map(row => <tr key={row.id}>
            <td style={{ padding:'10px 8px' }}><input className="input" value={row.name} onChange={e => update(row.id, 'name', e.target.value)} /></td>
            <td style={{ padding:'10px 8px' }}><input className="input" type="number" min="0" value={row.reviewed} onChange={e => update(row.id, 'reviewed', e.target.value)} /></td>
            <td style={{ padding:'10px 8px' }}><input className="input" type="number" min="0" max={row.reviewed} value={row.unique} onChange={e => update(row.id, 'unique', e.target.value)} /></td>
            <td style={{ padding:'10px 8px' }}><strong>{pct(row.ucr)}</strong></td>
            <td style={{ padding:'10px 8px' }}><input className="input" type="number" min="0" step="0.01" value={row.cost} onChange={e => update(row.id, 'cost', e.target.value)} /></td>
            <td style={{ padding:'10px 8px' }}>{row.costPerUnique == null ? '—' : `$${row.costPerUnique.toFixed(2)}`}</td>
            <td style={{ padding:'10px 8px' }}><button className="button secondary" type="button" onClick={() => removeRow(row.id)}>Remove</button></td>
          </tr>)}
        </tbody>
      </table>
    </div>

    <div style={{ marginTop: 16 }}><button className="button secondary" type="button" onClick={addRow}>+ Add source</button></div>

    <section style={{ marginTop: 30 }}>
      <h2>How to read the result</h2>
      <div className="grid two">
        <div className="card"><span className="kicker">High UCR</span><p>A large share of the reviewed candidates from this source were not surfaced by the other sources in the same comparison. The source appears additive for this requisition and test design.</p></div>
        <div className="card"><span className="kicker">Low UCR</span><p>Most reviewed candidates also appeared elsewhere. That can indicate redundancy, but do not cut a source without considering role family, quality, speed, response, cost, and source-order effects.</p></div>
      </div>
    </section>

    <section className="article-callout" style={{ marginTop: 26 }}>
      <h2>Do not compare unlike tests</h2>
      <ul>
        <li>Keep the requisition and search window fixed.</li>
        <li>Use comparable effort or reviewed-result caps per source.</li>
        <li>Rotate source order across repeated tests so the first source does not automatically look more unique.</li>
        <li>Dedupe on stable identity anchors, with human review when identity is uncertain.</li>
        <li>Report UCR by role family rather than blending unlike markets into one headline number.</li>
      </ul>
    </section>

    <div className="cta"><strong>Methodology:</strong> <Link href="/blog/unique-contribution-rate/">read the Unique Contribution Rate guide</Link> · <Link href="/blog/search-exhaustion-framework/">pair it with the Search Exhaustion framework</Link></div>
  </div>
}
