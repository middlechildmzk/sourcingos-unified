from pathlib import Path

workspace_path = Path('next-public/components/SearchWorkspaceV38_1.tsx')
css_path = Path('next-public/components/SearchWorkspaceV38_1.module.css')
test_path = Path('next-public/tests/v40-agentic-foundation.test.ts')

workspace = workspace_path.read_text()
css = css_path.read_text()
test = test_path.read_text()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)

workspace = replace_once(
    workspace,
    "type SearchResult = { observations: Observation[]; reviewObservations: SignedReviewObservation[]; telemetry: Telemetry[]; discoveredBeforeCap: number; returnedAfterCap: number; contributingProviders: number; relevanceRejected?: number; warnings: string[]; searchHealth?: SearchHealthSessionV38 }",
    "type AutoCaptureResult = { enabled: boolean; attempted: number; persisted: number; created: number; reused: number; failed: number; identityResolutionDeferred: boolean; contactValuesCaptured: boolean }\ntype SearchResult = { observations: Observation[]; reviewObservations: SignedReviewObservation[]; telemetry: Telemetry[]; discoveredBeforeCap: number; returnedAfterCap: number; contributingProviders: number; relevanceRejected?: number; warnings: string[]; searchHealth?: SearchHealthSessionV38; autoCapture?: AutoCaptureResult }",
    'SearchResult type',
)

workspace = replace_once(
    workspace,
    "  const quality = payload.searchQuality && typeof payload.searchQuality === 'object' ? (payload.searchQuality as { v38?: SearchHealthSessionV38 }).v38 : undefined\n  return {",
    "  const quality = payload.searchQuality && typeof payload.searchQuality === 'object' ? (payload.searchQuality as { v38?: SearchHealthSessionV38 }).v38 : undefined\n  const capture = payload.autoCapture && typeof payload.autoCapture === 'object' ? payload.autoCapture as Partial<AutoCaptureResult> : undefined\n  return {",
    'capture parse',
)

workspace = replace_once(
    workspace,
    "    reviewObservations: Array.isArray(payload.reviewObservations) ? payload.reviewObservations as SignedReviewObservation[] : [],\n    telemetry:",
    "    reviewObservations: Array.isArray(payload.reviewObservations) ? payload.reviewObservations as SignedReviewObservation[] : [],\n    autoCapture: capture ? { enabled: Boolean(capture.enabled), attempted: Number(capture.attempted || 0), persisted: Number(capture.persisted || 0), created: Number(capture.created || 0), reused: Number(capture.reused || 0), failed: Number(capture.failed || 0), identityResolutionDeferred: capture.identityResolutionDeferred !== false, contactValuesCaptured: Boolean(capture.contactValuesCaptured) } : undefined,\n    telemetry:",
    'capture normalization',
)

workspace = replace_once(
    workspace,
    "  const observations = result?.observations || []\n  const selected =",
    "  const observations = result?.observations || []\n  const capture = result?.autoCapture\n  const selected =",
    'capture derived state',
)

old_final = "      const nextResult = normalizeSearchResult(finalPayload); setLiveTelemetry(nextResult.telemetry); setResult(nextResult); if (nextResult.observations.length) setSelectedIndex(0); setComposerMode('ask'); addChat('assistant', 'search', `I retained ${nextResult.observations.length} candidate${nextResult.observations.length === 1 ? '' : 's'} from ${nextResult.discoveredBeforeCap || nextResult.observations.length} discoveries. I am now in review mode—ask about this slate without rerunning providers.`)"
new_final = "      const nextResult = normalizeSearchResult(finalPayload); setLiveTelemetry(nextResult.telemetry); setResult(nextResult); if (nextResult.observations.length) setSelectedIndex(0); setComposerMode('ask'); const captureNote = nextResult.autoCapture?.enabled ? ` I also captured ${nextResult.autoCapture.persisted} source observation${nextResult.autoCapture.persisted === 1 ? '' : 's'} into durable SourcingOS memory (${nextResult.autoCapture.created} new, ${nextResult.autoCapture.reused} refreshed${nextResult.autoCapture.failed ? `, ${nextResult.autoCapture.failed} capture failed` : ''}).` : ''; addChat('assistant', 'search', `I retained ${nextResult.observations.length} candidate${nextResult.observations.length === 1 ? '' : 's'} from ${nextResult.discoveredBeforeCap || nextResult.observations.length} discoveries.${captureNote} I am now in review mode—ask about this slate without rerunning providers.`)"
workspace = replace_once(workspace, old_final, new_final, 'final search chat')

workspace = workspace.replace('<span className="search-kicker">Sourcing copilot</span>', '<span className="search-kicker">AI sourcing copilot</span>', 1)

old_header = "<header className=\"search-results-head\"><div><span className=\"search-kicker\">Candidate slate</span><h2>{working === 'searching' ? 'Researching talent…' : result ? `${observations.length} retained candidates` : web ? 'Live web research' : 'Your results will appear here'}</h2></div><div className=\"search-results-meta\">{result && <><span>{result.discoveredBeforeCap || observations.length} discovered</span><span>{result.contributingProviders || 0} sources</span>{Boolean(result.relevanceRejected) && <span>{result.relevanceRejected} relevance filtered</span>}</>}{!!observations.length && <span>J/K review</span>}</div></header>"
new_header = "<header className=\"search-results-head\"><div><span className=\"search-kicker\">Candidate slate</span><h2>{working === 'searching' ? 'AI sourcing in progress…' : result ? `${observations.length} retained candidates` : web ? 'Live web research' : 'Your results will appear here'}</h2></div><div className=\"search-results-meta\">{result && <><span>{result.discoveredBeforeCap || observations.length} discovered</span><span>{result.contributingProviders || 0} sources</span>{capture?.enabled && <span>{capture.persisted} captured</span>}{Boolean(result.relevanceRejected) && <span>{result.relevanceRejected} relevance filtered</span>}</>}{!!observations.length && <span>J/K review</span>}</div></header>"
workspace = replace_once(workspace, old_header, new_header, 'results header')

old_progress = "<section className=\"provider-progress\" aria-label=\"Source execution status\"><div className=\"search-section-title\"><span>Source execution</span><small>{working && !['contacts','saving'].includes(working) ? 'live' : sourceTelemetry.length ? 'latest search' : 'ready'}</small></div>{working && !['contacts','saving'].includes(working) && <div className=\"provider-progress-bar\"><span /></div>}<div className=\"provider-progress-list\">{sourceTelemetry.length ? sourceTelemetry.map(item => <div className={`provider-progress-item ${statusClass(item.status)}`} key={item.provider} title={item.message || ''}><i /><span>{label(item.provider)}</span><b>{item.status === 'eligible' ? 'eligible' : item.status}</b>{item.discovered > 0 && <small>{item.discovered}</small>}</div>) : <span className=\"search-empty-copy\">Provider execution telemetry will appear here. Eligible is not the same as executed.</span>}</div></section>"
new_progress = """<section className=\"provider-progress\" aria-label=\"AI sourcing agent activity\">
        <div className=\"search-section-title\"><span>Agent activity</span><small>{working && !['contacts','saving'].includes(working) ? 'live run' : result ? 'run complete' : 'ready'}</small></div>
        <div className={styles.agentPipeline}>
          <div data-state={working === 'planning' ? 'active' : plan ? 'done' : 'idle'}><i>1</i><span><b>Understand brief</b><small>{plan ? 'Requirements and discovery expansion separated.' : 'Waiting for recruiter intent.'}</small></span></div>
          <div data-state={working === 'searching' ? 'active' : result ? 'done' : 'idle'}><i>2</i><span><b>Orchestrate sources</b><small>{working === 'searching' ? 'Searching configured people sources now.' : result ? `${result.contributingProviders || 0} source${result.contributingProviders === 1 ? '' : 's'} contributed.` : 'Provider execution begins after planning.'}</small></span></div>
          <div data-state={capture?.enabled ? (capture.failed ? 'warning' : 'done') : working === 'searching' ? 'queued' : 'idle'}><i>3</i><span><b>Capture memory</b><small>{capture?.enabled ? `${capture.persisted} persisted · ${capture.created} new · ${capture.reused} refreshed${capture.failed ? ` · ${capture.failed} failed` : ''}` : working === 'searching' ? 'Queued behind source normalization.' : 'Retained discoveries become durable memory.'}</small></span></div>
          <div data-state={result ? 'done' : 'idle'}><i>4</i><span><b>Review ready</b><small>{result ? `${observations.length} candidates retained for human review.` : 'Evidence stays uncertain until reviewed.'}</small></span></div>
        </div>
        {working && !['contacts','saving'].includes(working) && <div className=\"provider-progress-bar\"><span /></div>}
        <div className=\"provider-progress-list\">{sourceTelemetry.length ? sourceTelemetry.map(item => <div className={`provider-progress-item ${statusClass(item.status)}`} key={item.provider} title={item.message || ''}><i /><span>{label(item.provider)}</span><b>{item.status === 'eligible' ? 'eligible' : item.status}</b>{item.discovered > 0 && <small>{item.discovered}</small>}</div>) : <span className=\"search-empty-copy\">Executed source telemetry appears here as the agent works. Eligible is not the same as executed.</span>}</div>
      </section>"""
workspace = replace_once(workspace, old_progress, new_progress, 'agent activity block')

old_steps = "{result && <div className={styles.nextSteps}><div><strong>Results are ready. What next?</strong><span>Review a candidate → inspect evidence/profile history → find contact if needed → save/disposition → refine or export.</span></div><div className={styles.bulkActions}><button type=\"button\" onClick={() => void saveAll()} disabled={Boolean(working)}>{bulkStatus || 'Save all retained'}</button><button type=\"button\" onClick={exportCsv}>Export CSV</button></div></div>}"
new_steps = "{result && <div className={styles.nextSteps}><div><strong>{capture?.enabled ? 'Discoveries captured. Review the slate.' : 'Results are ready. What next?'}</strong><span>{capture?.enabled ? 'SourcingOS memory is already updated. Review evidence → add strong people to the role → find contact only when needed → refine or export.' : 'Review a candidate → inspect evidence/profile history → find contact if needed → save/disposition → refine or export.'}</span></div><div className={styles.bulkActions}>{role && <button type=\"button\" onClick={() => void saveAll()} disabled={Boolean(working)}>{bulkStatus || 'Add all to role'}</button>}<button type=\"button\" onClick={exportCsv}>Export CSV</button></div></div>}"
workspace = replace_once(workspace, old_steps, new_steps, 'next steps semantics')

old_zero = "<div className=\"search-zero-state\"><div className=\"search-zero-mark\">⌕</div><h3>Search starts with intent, not filters.</h3><p>Describe the role in recruiter language. SourcingOS separates requirements from discovery expansion and keeps evidence uncertainty visible.</p>"
new_zero = "<div className=\"search-zero-state\"><div className=\"search-zero-mark\">✦</div><h3>Give the sourcing agent a hiring brief.</h3><p>Describe the role naturally. SourcingOS will interpret the requirements, orchestrate available sources, capture durable discoveries, and return an evidence-first slate you can refine conversationally.</p>"
workspace = replace_once(workspace, old_zero, new_zero, 'zero state')

old_empty_chat = "Search creates the slate. After results arrive, Ask about results keeps the slate in context and does not rerun providers."
new_empty_chat = "Tell the copilot who you need. The agent interprets the brief, runs eligible sources, captures retained discoveries into SourcingOS memory, and then keeps the returned slate in context for follow-up questions."
workspace = replace_once(workspace, old_empty_chat, new_empty_chat, 'conversation empty copy')

css_addition = r'''
.agentPipeline{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:2px 0 11px}
.agentPipeline>div{position:relative;display:grid;grid-template-columns:24px minmax(0,1fr);gap:7px;align-items:start;min-height:60px;padding:9px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.018);opacity:.62}
.agentPipeline>div>i{width:22px;height:22px;display:grid;place-items:center;border-radius:7px;background:rgba(255,255,255,.045);font-style:normal;font-size:9px;font-weight:900;color:var(--muted)}
.agentPipeline>div>span{min-width:0}.agentPipeline b{display:block;font-size:10px;line-height:1.25}.agentPipeline small{display:block;margin-top:3px;color:var(--muted);font-size:8px;line-height:1.35}
.agentPipeline>div[data-state='active']{opacity:1;border-color:rgba(146,147,255,.5);background:rgba(146,147,255,.08);box-shadow:inset 0 0 0 1px rgba(146,147,255,.07)}.agentPipeline>div[data-state='active']>i{background:rgba(146,147,255,.2);color:#dadaff;animation:sos-pulse 1.2s ease-in-out infinite}
.agentPipeline>div[data-state='done']{opacity:1;border-color:color-mix(in srgb,var(--sos-success) 28%,var(--line));background:var(--sos-success-soft)}.agentPipeline>div[data-state='done']>i{background:var(--sos-success-soft);color:var(--sos-success)}
.agentPipeline>div[data-state='queued']{opacity:.82;border-style:dashed}.agentPipeline>div[data-state='warning']{opacity:1;border-color:rgba(246,201,107,.38);background:rgba(246,201,107,.055)}.agentPipeline>div[data-state='warning']>i{color:#f6c96b}
@media(max-width:1180px){.agentPipeline{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:900px){.agentPipeline{grid-template-columns:1fr}}
'''
if '.agentPipeline{' not in css:
    css = css.rstrip() + '\n' + css_addition.strip() + '\n'

if "const workspace = read('components/SearchWorkspaceV38_1.tsx')" not in test:
    test = test.replace(
        "const capture = read('lib/candidate-data/auto-capture-v40.ts')",
        "const capture = read('lib/candidate-data/auto-capture-v40.ts')\nconst workspace = read('components/SearchWorkspaceV38_1.tsx')\nconst workspaceCss = read('components/SearchWorkspaceV38_1.module.css')",
    )
    marker = "  it('keeps automatic capture outside contact reveal, identity merge, and recruiter decision authority', () => {"
    insertion = """  it('makes agent execution and durable capture visible in the recruiter cockpit', () => {
    expect(workspace).toContain('AI sourcing copilot')
    expect(workspace).toContain('Agent activity')
    expect(workspace).toContain('Understand brief')
    expect(workspace).toContain('Orchestrate sources')
    expect(workspace).toContain('Capture memory')
    expect(workspace).toContain('Review ready')
    expect(workspace).toContain('capture.persisted')
    expect(workspace).toContain('Add all to role')
    expect(workspaceCss).toContain('.agentPipeline')
    expect(workspaceCss).toContain(".search-workspace-right.has-selection")
  })

"""
    test = test.replace(marker, insertion + marker, 1)

workspace_path.write_text(workspace)
css_path.write_text(css)
test_path.write_text(test)
