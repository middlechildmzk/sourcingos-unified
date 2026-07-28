import fs from 'node:fs'

function transformConnectors() {
  const path = 'next-public/lib/source-connectors.ts'
  let text = fs.readFileSync(path, 'utf8')

  const demoStart = text.indexOf('function demoResult(')
  const demoEnd = text.indexOf('function buildCommonIdentity(', demoStart)
  if (demoStart >= 0 && demoEnd > demoStart) {
    text = text.slice(0, demoStart) + text.slice(demoEnd)
  }

  const gateStart = text.indexOf('// Gate demo/fallback results behind an explicit env flag.')
  const githubStart = text.indexOf('export async function searchGitHub', gateStart)
  if (gateStart >= 0 && githubStart > gateStart) {
    text = text.slice(0, gateStart) + text.slice(githubStart)
  }

  text = text.replace(/maybeDemo\([^)]*\)/g, '[]')
  text = text.replace('Demo fallback may be used.', 'The source did not return a usable result.')
  text = text.replace('Use demo fallback below if no packages resolve.', 'Return no results if no packages resolve.')

  if (/demoResult|maybeDemo|NEXT_PUBLIC_ENABLE_DEMO_SOURCE_RESULTS/.test(text)) {
    throw new Error('Synthetic source fallback references remain')
  }

  fs.writeFileSync(path, text)
}

function transformCandidateDb() {
  const path = 'next-public/components/CandidateDbClient.tsx'
  let text = fs.readFileSync(path, 'utf8')

  function replaceOnce(search, replacement, label) {
    if (!text.includes(search)) {
      if (text.includes(replacement)) return
      throw new Error(`Missing Candidate DB kind marker: ${label}`)
    }
    text = text.replace(search, replacement)
  }

  replaceOnce(
    "  const end = snapshot.page.offset + snapshot.candidates.length\n\n  return <div className=\"interactive-tool\">",
    `  const end = snapshot.page.offset + snapshot.candidates.length
  const personCandidates = snapshot.candidates.filter(candidate => candidate.entityKind === 'person')
  const supportingCandidates = snapshot.candidates.filter(candidate => candidate.entityKind !== 'person')

  return <div className="interactive-tool">`,
    'page subject groups',
  )

  replaceOnce(
    '<div className="product-stat"><small>Canonical candidates</small><b>{snapshot.counts.candidates.toLocaleString()}</b><span>Owner-scoped identities</span></div>',
    '<div className="product-stat"><small>Stored identity records</small><b>{snapshot.counts.candidates.toLocaleString()}</b><span>{snapshot.counts.personCandidatesOnPage} people on this page</span></div>',
    'honest top count',
  )

  replaceOnce(
    '<div className="product-panel-head"><div><span className="kicker">Candidate Graph</span><h2>Candidates</h2></div><span>{start.toLocaleString()}–{end.toLocaleString()} of {snapshot.counts.filteredCandidates.toLocaleString()}</span></div>',
    '<div className="product-panel-head"><div><span className="kicker">Candidate Graph</span><h2>People</h2></div><span>{personCandidates.length} people · records {start.toLocaleString()}–{end.toLocaleString()}</span></div>',
    'people heading',
  )

  replaceOnce(
    '{snapshot.candidates.map(candidate => {',
    '{personCandidates.map(candidate => {',
    'people-only main list',
  )

  replaceOnce(
    "            {!loading && !snapshot.candidates.length && <div className=\"product-row\"><div className=\"product-row-main\"><div className=\"product-row-title\">No matching candidates</div><div className=\"product-row-meta\">Try a broader search or import an authorized candidate file.</div></div></div>}\n            {loading &&",
    `            {!loading && !personCandidates.length && <div className="product-row"><div className="product-row-main"><div className="product-row-title">No person records on this page</div><div className="product-row-meta">Continue to another page, broaden the search, or review supporting subjects below.</div></div></div>}
            {loading &&`,
    'people empty state',
  )

  const listClose = `          </div>
          <div className="button-row" style={{ justifyContent: 'space-between', marginTop: 14 }}><button className="btn secondary" disabled={snapshot.page.offset === 0 || loading}`
  const supportingBlock = `          </div>
          {supportingCandidates.length > 0 && (
            <details className="advanced-disclosure" style={{ marginTop: 14 }}>
              <summary>Supporting or unclassified subjects ({supportingCandidates.length})</summary>
              <div className="product-list" style={{ marginTop: 10 }}>
                {supportingCandidates.map(subject => (
                  <div className="product-row" key={subject.id}>
                    <div className="product-row-main">
                      <div className="product-row-title">{subject.canonicalName}</div>
                      <div className="product-row-meta">{words(subject.entityKind)} · not available for role assignment</div>
                    </div>
                    <Link className="btn ghost" href={\`/app/candidate/\${subject.id}\`}>Review record</Link>
                  </div>
                ))}
              </div>
            </details>
          )}
          <div className="button-row" style={{ justifyContent: 'space-between', marginTop: 14 }}><button className="btn secondary" disabled={snapshot.page.offset === 0 || loading}`
  replaceOnce(listClose, supportingBlock, 'supporting subject disclosure')

  fs.writeFileSync(path, text)
}

transformConnectors()
transformCandidateDb()
console.log('Removed synthetic connector fallbacks and separated stored subjects')
