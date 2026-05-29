import { useEffect, useState } from 'react';
import { connectors, sampleJDs, sourcingModes } from './data';
import { useSourcingStore } from './store';
import type { CandidateStage, ConnectorStatus, ContactSignal, EvidenceMatrixRow, FeedbackEvent, SourcedCandidate, SourceProfile } from './types';

const tabs = [
  ['intake', '1. Intake + Market Map'], ['results', '2. Source Results'], ['candidate', '3. Candidate 360'], ['pipeline', '4. Pipeline'], ['ai', 'AI Synthesis'], ['memory', 'Memory + Rediscovery'], ['connectors', 'Connectors'], ['roadmap', 'Roadmap']
] as const;
const stageOptions: CandidateStage[] = ['new','reviewed','saved','screen','submitted','rejected'];
const feedbackLabels: FeedbackEvent['label'][] = ['strong_fit','good_fit','maybe','bad_fit','too_junior','too_senior','wrong_location','wrong_domain','wrong_clearance','great_signal'];
function copy(text: string) { navigator.clipboard?.writeText(text).catch(() => undefined); }
function Pill({ children, tone='neutral' }: { children: React.ReactNode; tone?: 'neutral'|'good'|'warn'|'danger'|'blue' }) { return <span className={`pill ${tone}`}>{children}</span>; }
function Card({ title, eyebrow, children, actions }: { title: string; eyebrow?: string; children: React.ReactNode; actions?: React.ReactNode }) { return <section className="card"><div className="card-head"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h2>{title}</h2></div>{actions && <div className="actions">{actions}</div>}</div>{children}</section>; }
function List({ items }: { items: string[] }) { return <ul className="list">{items.map((i, idx) => <li key={`${i}-${idx}`}>{i}</li>)}</ul>; }
function CodeBox({ label, text }: { label: string; text: string }) { return <div className="code-box"><div><span>{label}</span><button onClick={() => copy(text)}>Copy</button></div><code>{text}</code></div>; }
function scoreTone(score: number) { return score >= 78 ? 'good' : score >= 58 ? 'warn' : 'danger'; }

function Header() { const { resetWorkspace } = useSourcingStore(); return <header className="hero"><div><div className="eyebrow">Private local-first sourcing cockpit</div><h1>SourcingOS Core <span>V15.9</span></h1><p>JD intake → public API sourcing → Candidate Intelligence Graph → 10-source connector pack → AI synthesis → memory + rediscovery.</p></div><button className="ghost" onClick={resetWorkspace}>Reset local workspace</button></header>; }
function Nav() { const { activeTab, setActiveTab } = useSourcingStore(); return <nav className="tabs">{tabs.map(([id, label]) => <button key={id} className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>{label}</button>)}</nav>; }
function CommandBar() { const { roleAnalysis, sourcedCandidates, pipeline, notes, feedbackEvents } = useSourcingStore(); const linked = sourcedCandidates.reduce((n, c) => n + c.sourceProfiles.length, 0); return <div className="command-bar"><div><span>Role</span><strong>{roleAnalysis?.roleTitle || 'None'}</strong></div><div><span>Difficulty</span><strong>{roleAnalysis?.poolEstimate.difficulty || 0}</strong></div><div><span>Results</span><strong>{sourcedCandidates.length}</strong></div><div><span>Linked profiles</span><strong>{linked}</strong></div><div><span>Pipeline</span><strong>{pipeline.length}</strong></div><div><span>Feedback</span><strong>{feedbackEvents.length}</strong></div><div className="notes"><span>Next</span><strong>{notes[0]}</strong></div></div>; }

function IntakeMarketMap() {
  const { jdText, setJdText, mode, setMode, loadSampleJD, analyzeCurrentRole, roleAnalysis, sourceCandidates, loadDemoResults, currentRunStatus } = useSourcingStore();
  return <div className="grid split"><Card title="Upload / Paste Role Info" eyebrow="Step 1: Parse fields, titles, keywords, filters"><div className="sample-row">{sampleJDs.map(sample => <button key={sample.id} className="secondary" onClick={() => loadSampleJD(sample.id)}>{sample.name}</button>)}</div><label>Sourcing mode</label><select value={mode} onChange={e => setMode(e.target.value as typeof mode)}>{sourcingModes.map(m => <option key={m}>{m}</option>)}</select><label>Job description / role notes</label><textarea value={jdText} onChange={e => setJdText(e.target.value)} rows={15} placeholder="Paste a JD, recruiter notes, HM intake, or rough req summary..." /><div className="button-row"><button onClick={analyzeCurrentRole}>Analyze JD / Build Market Map</button>{roleAnalysis && <button className="primary-alt" onClick={sourceCandidates} disabled={currentRunStatus === 'running'}>{currentRunStatus === 'running' ? 'Sourcing from APIs...' : 'Source Candidates from APIs'}</button>}<button className="secondary" onClick={loadDemoResults}>Load demo results</button></div><div className="guardrail">Official/public APIs only where available. Manual sources stay manual. No scraping, no auto-send, no clearance verification claims from public breadcrumbs.</div></Card><Card title="Parsed Role Strategy + Pool Estimate" eyebrow="Step 2: Understand supply before sourcing">{roleAnalysis ? <><div className="score-band"><div><span>Role</span><strong>{roleAnalysis.roleTitle}</strong></div><div><span>Difficulty</span><strong>{roleAnalysis.poolEstimate.difficulty}/100</strong><Pill tone={scoreTone(100 - roleAnalysis.poolEstimate.difficulty)}>{roleAnalysis.poolEstimate.difficultyLabel}</Pill></div></div><p>{roleAnalysis.summary}</p><div className="estimate"><strong>{roleAnalysis.poolEstimate.estimatedPool}</strong><p>{roleAnalysis.poolEstimate.githubRepoSignal}</p><p>{roleAnalysis.poolEstimate.stackOverflowSignal}</p></div><h3>Parsed fields</h3><div className="field-grid">{roleAnalysis.parsedFields.map(f => <div key={f.label}><span>{f.label}</span><strong>{f.value}</strong><small>{Math.round(f.confidence * 100)}% confidence</small></div>)}</div><div className="mini-grid"><div><h3>Target titles</h3><List items={roleAnalysis.targetTitles} /></div><div><h3>Adjacent titles</h3><List items={roleAnalysis.adjacentTitles} /></div><div><h3>Keywords</h3><div className="tag-cloud">{roleAnalysis.keywords.map(k => <Pill key={k}>{k}</Pill>)}</div></div><div><h3>Expansion suggestions</h3><List items={roleAnalysis.poolEstimate.expansionSuggestions} /></div></div><h3>Search strings</h3>{roleAnalysis.booleanStrings.map((s, i) => <CodeBox key={s} label={`Boolean ${i + 1}`} text={s} />)}{roleAnalysis.xrayStrings.map((s, i) => <CodeBox key={s} label={`X-Ray ${i + 1}`} text={s} />)}<h3>Search lanes</h3><div className="lane-grid">{roleAnalysis.searchLanes.map(l => <div className="lane" key={l.id}><strong>{l.name}</strong><span>{l.bestSource}</span><p>{l.goal}</p><CodeBox label="lane query" text={l.query} /></div>)}</div></> : <p>Analyze a role to see the market map.</p>}</Card></div>;
}

function CandidateCard({ candidate }: { candidate: SourcedCandidate }) {
  const { selectCandidate, promoteToPipeline, updateCandidateStage, synthesizeCandidate, addFeedback } = useSourcingStore(); const [note, setNote] = useState('');
  return <div className="candidate-card"><div className="candidate-top">{candidate.avatarUrl && <img src={candidate.avatarUrl} alt="" />}<div><h3>{candidate.name}</h3><p>{candidate.headline}</p><a href={candidate.profileUrl} target="_blank" rel="noreferrer">{candidate.source} profile</a></div><strong className="big-score">{candidate.fitScore}</strong></div><div className="status-grid"><Pill tone={scoreTone(candidate.fitScore)}>Fit {candidate.fitScore}</Pill><Pill>Depth {candidate.technicalDepthScore}</Pill><Pill>Contact {candidate.contactabilityScore}</Pill><Pill>Complete {candidate.profileCompleteness}</Pill><Pill>Profiles {candidate.sourceProfiles.length}</Pill><select value={candidate.stage} onChange={e => updateCandidateStage(candidate.id, e.target.value as CandidateStage)}>{stageOptions.map(s => <option key={s}>{s}</option>)}</select></div><div className="tag-cloud">{candidate.matchedSkills.slice(0, 12).map(s => <Pill key={s}>{s}</Pill>)}</div><p className="muted">{candidate.evidence[0]?.detail || 'No evidence item available.'}</p><div className="button-row"><button onClick={() => selectCandidate(candidate.id)}>Open Candidate 360</button><button className="secondary" onClick={() => promoteToPipeline(candidate.id)}>Recruiter-confirm save</button><button className="secondary" onClick={() => synthesizeCandidate(candidate.id)}>Synthesize</button></div><div className="feedback-row"><select onChange={e => e.currentTarget.dataset.value = e.target.value} defaultValue="good_fit" id={`fb-${candidate.id}`}>{feedbackLabels.map(f => <option key={f}>{f}</option>)}</select><input value={note} onChange={e => setNote(e.target.value)} placeholder="feedback note" /><button className="ghost" onClick={() => { const select = document.getElementById(`fb-${candidate.id}`) as HTMLSelectElement | null; addFeedback(candidate.id, (select?.value || 'good_fit') as FeedbackEvent['label'], note); setNote(''); }}>Save feedback</button></div></div>;
}
function SourceResults() { const { sourcedCandidates, sourceError, currentRunStatus, sourceRuns } = useSourcingStore(); return <div><Card title="Candidate Results" eyebrow="Step 3: Public API candidates ranked by fit, depth, contactability, and completeness" actions={<Pill>{currentRunStatus}</Pill>}>{sourceError && <div className="guardrail warn">{sourceError}</div>}{sourcedCandidates.length === 0 ? <p>No candidates yet. Source from the intake tab or load demo results.</p> : <div className="results-grid">{sourcedCandidates.map(c => <CandidateCard candidate={c} key={c.id} />)}</div>}</Card><Card title="Source Runs" eyebrow="Audit trail"><div className="timeline">{sourceRuns.map(r => <div key={r.id}><strong>{r.status} · {r.resultCount} results</strong><span>{r.querySummary}</span>{r.errors.length > 0 && <em>{r.errors.join(' | ')}</em>}</div>)}</div></Card></div>; }

function ProfileLinker({ candidate }: { candidate: SourcedCandidate }) {
  const { linkProfilesForCandidate, profileLinkStatus, profileLinkError, confirmCandidateMerge, rejectCandidateMerge } = useSourcingStore();
  const [githubUrl, setGithubUrl] = useState(candidate.source === 'github' ? candidate.profileUrl : ''); const [stackOverflowUrl, setStackOverflowUrl] = useState(candidate.source === 'stackoverflow' ? candidate.profileUrl : ''); const [openAlexQuery, setOpenAlexQuery] = useState(candidate.name); const [huggingFaceUser, setHuggingFaceUser] = useState(''); const [npmPackage, setNpmPackage] = useState(''); const [pypiPackage, setPypiPackage] = useState(''); const [orcid, setOrcid] = useState(''); const [manualLinkedInUrl, setManualLinkedInUrl] = useState(''); const [personalWebsite, setPersonalWebsite] = useState(''); const suggestion = candidate.identityMergeSuggestion;
  return <Card title="Profile Linker + Identity Merge Preview" eyebrow="V15.6.1/V15.7 Candidate Intelligence Graph"><div className="link-grid"><label>GitHub URL / username<input value={githubUrl} onChange={e => setGithubUrl(e.target.value)} placeholder="https://github.com/username" /></label><label>Stack Overflow user URL / ID<input value={stackOverflowUrl} onChange={e => setStackOverflowUrl(e.target.value)} placeholder="https://stackoverflow.com/users/12345/name" /></label><label>OpenAlex author search<input value={openAlexQuery} onChange={e => setOpenAlexQuery(e.target.value)} /></label><label>Hugging Face user<input value={huggingFaceUser} onChange={e => setHuggingFaceUser(e.target.value)} placeholder="username" /></label><label>npm package<input value={npmPackage} onChange={e => setNpmPackage(e.target.value)} placeholder="package-name" /></label><label>PyPI package<input value={pypiPackage} onChange={e => setPypiPackage(e.target.value)} placeholder="package-name" /></label><label>ORCID<input value={orcid} onChange={e => setOrcid(e.target.value)} placeholder="0000-0000-0000-0000" /></label><label>Manual LinkedIn URL, store-only<input value={manualLinkedInUrl} onChange={e => setManualLinkedInUrl(e.target.value)} /></label><label>Personal website / portfolio<input value={personalWebsite} onChange={e => setPersonalWebsite(e.target.value)} /></label></div><div className="button-row"><button onClick={() => linkProfilesForCandidate(candidate.id, { githubUrl, stackOverflowUrl, openAlexQuery, huggingFaceUser, npmPackage, pypiPackage, orcid, manualLinkedInUrl, personalWebsite })} disabled={profileLinkStatus === 'running'}>{profileLinkStatus === 'running' ? 'Fetching public evidence...' : 'Fetch Public Evidence + Build Merge Preview'}</button>{suggestion && <button className="secondary" onClick={() => confirmCandidateMerge(candidate.id)}>Recruiter-confirm link</button>}{suggestion && <button className="ghost" onClick={() => rejectCandidateMerge(candidate.id)}>Keep separate</button>}</div>{profileLinkError && <div className="guardrail warn">{profileLinkError}</div>}{suggestion && <div className="merge-preview"><div><strong>Merge confidence: {Math.round(suggestion.confidence * 100)}%</strong><Pill tone={suggestion.confidenceLabel === 'high' ? 'good' : suggestion.confidenceLabel === 'medium' ? 'warn' : 'danger'}>{suggestion.confidenceLabel}</Pill><Pill>{suggestion.status}</Pill></div><List items={suggestion.reasons} />{suggestion.conflicts.length > 0 && <><h4>Conflicts to review</h4><List items={suggestion.conflicts} /></>}</div>}<div className="guardrail">Never auto-merge on name alone. Public contact signals are not verified. Recruiter must confirm before outreach.</div></Card>;
}

function ContactSignalRow({ signal }: { signal: ContactSignal }) {
  const tone = signal.verificationStatus === 'recruiter_verified' ? 'good' : signal.verificationStatus === 'conflict' ? 'danger' : signal.confidence === 'high' ? 'blue' : 'warn';
  return <div className="contact-signal-row"><div><strong>{signal.type}</strong><span>{signal.value}</span><small>{signal.riskNote}</small></div><div><Pill tone={tone}>{signal.verificationStatus}</Pill><Pill>{signal.confidence}</Pill><Pill>{signal.source}</Pill></div></div>;
}

function SourceProfileCard({ profile }: { profile: SourceProfile }) {
  const tone = profile.status === 'linked' ? 'good' : profile.status === 'rejected' ? 'danger' : 'warn';
  return <div className="sp-card"><div className="sp-card-top">{profile.avatarUrl && <img src={profile.avatarUrl} alt="" />}<div><h4>{profile.displayName || profile.username || profile.source}</h4><p>{profile.headline || profile.rawSummary}</p>{profile.location && <small>{profile.location}</small>}</div></div><div className="sp-meta"><Pill tone={tone}>{profile.status}</Pill><Pill>{profile.source}</Pill><Pill>{profile.confidence} evidence</Pill><a href={profile.url} target="_blank" rel="noreferrer">Open</a></div><p className="muted small">{profile.rawSummary}</p></div>;
}

function IdentityGraphBanner({ candidate }: { candidate: SourcedCandidate }) {
  const suggestion = candidate.identityMergeSuggestion;
  if (!suggestion) return <div className="match-banner low"><div className="match-header"><span>Identity graph waiting for linked evidence</span><Pill>no suggestion yet</Pill></div><p>Use the Profile Linker to attach public profiles. SourcingOS will suggest a merge, but it will not merge identities without recruiter confirmation.</p></div>;
  const tone = suggestion.status === 'confirmed' ? 'good' : suggestion.status === 'rejected' ? 'danger' : suggestion.confidenceLabel === 'high' ? 'good' : suggestion.confidenceLabel === 'medium' ? 'warn' : 'neutral';
  return <div className={`match-banner ${suggestion.confidenceLabel}`}><div className="match-header"><span>Identity match suggestion</span><Pill tone={tone}>{Math.round(suggestion.confidence * 100)}% · {suggestion.confidenceLabel} · {suggestion.status}</Pill></div><p><strong>Recommendation:</strong> {suggestion.recommendation.replace(/_/g, ' ')}. No auto-merge at any confidence level.</p><div className="match-signals">{suggestion.reasons.map((reason, idx) => <div className="signal-item medium" key={reason + idx}><span>signal</span>{reason}</div>)}</div>{suggestion.conflicts.length > 0 && <><h4>Conflicts to review</h4><List items={suggestion.conflicts} /></>}</div>;
}

function EvidenceMatrix({ rows }: { rows: EvidenceMatrixRow[] }) {
  return <div className="evidence-table"><div className="evidence-row head"><span>Signal / skill</span><span>Evidence detail</span><span>Source</span><span>Confidence</span></div>{rows.length ? rows.slice(0, 24).map((r, idx) => <div className="evidence-row" key={`${r.skill}-${idx}`}><span>{r.skill}</span><span>{r.url ? <a href={r.url} target="_blank" rel="noreferrer">{r.evidence}</a> : r.evidence}</span><span><Pill>{r.source}</Pill></span><span><Pill tone={r.confidence === 'high' ? 'good' : r.confidence === 'medium' ? 'warn' : 'neutral'}>{r.confidence}</Pill></span></div>) : <div className="evidence-row"><span>No rows yet</span><span>Link profiles or run demo results to populate source evidence.</span><span>manual</span><span>low</span></div>}</div>;
}

function Candidate360() { const { sourcedCandidates, selectedCandidateId, promoteToPipeline, synthesizeCandidate } = useSourcingStore(); const candidate = sourcedCandidates.find(c => c.id === selectedCandidateId) || sourcedCandidates[0]; if (!candidate) return <Card title="Candidate 360"><p>No candidate selected yet. Run a source search first.</p></Card>;
  return <div className="c360-layout"><div><Card title={candidate.name} eyebrow="Rich Candidate 360 evidence dossier" actions={<><button onClick={() => synthesizeCandidate(candidate.id)}>AI/local synthesis</button><button onClick={() => promoteToPipeline(candidate.id)}>Save to pipeline</button></>}><div className="candidate-hero">{candidate.avatarUrl && <img src={candidate.avatarUrl} alt="" />}<div><h2>{candidate.name}</h2><p>{candidate.headline}</p><p>{candidate.company} · {candidate.location}</p><a href={candidate.profileUrl} target="_blank" rel="noreferrer">Open original source profile</a></div><div className="big-score">{candidate.fitScore}</div></div><div className="status-grid"><Pill tone="good">Technical depth {candidate.technicalDepthScore}</Pill><Pill tone="blue">Source confidence {Math.round(candidate.sourceConfidence * 100)}%</Pill><Pill>Contactability {candidate.contactabilityScore}</Pill><Pill>Completeness {candidate.profileCompleteness}</Pill><Pill>Profiles {candidate.sourceProfiles.length}</Pill></div><IdentityGraphBanner candidate={candidate} /><h3>Evidence Matrix</h3><EvidenceMatrix rows={candidate.evidenceMatrix} /><h3>Evidence Timeline</h3><div className="timeline">{candidate.evidence.map(e => <div key={e.id}><strong>{e.label}</strong><span>{e.detail}</span>{e.url && <a href={e.url} target="_blank" rel="noreferrer">source</a>}</div>)}</div></Card></div><aside><ProfileLinker candidate={candidate} /><Card title="Source Profiles + Verification" eyebrow="Human review required"><h3>Linked source profiles</h3>{candidate.sourceProfiles.length ? <div className="source-profile-grid">{candidate.sourceProfiles.map(p => <SourceProfileCard profile={p} key={p.id} />)}</div> : <p>No linked source profiles yet.</p>}<h3>Contact signals</h3>{candidate.contactSignals.length ? <div className="contact-signals">{candidate.contactSignals.map(c => <ContactSignalRow signal={c} key={c.id} />)}</div> : <p>No contact signals captured yet.</p>}<h3>Missing / verify</h3><List items={candidate.missingSignals} /><h3>Guardrails</h3><List items={candidate.guardrails} /></Card></aside></div>;
}

function Pipeline() { const { pipeline, sourcedCandidates } = useSourcingStore(); return <Card title="Pipeline" eyebrow="Recruiter-confirmed candidates only">{pipeline.length === 0 ? <p>No saved candidates yet.</p> : <div className="table"><div className="tr head"><span>Candidate</span><span>Profiles</span><span>Fit</span><span>Notes</span></div>{pipeline.map(entry => { const c = sourcedCandidates.find(x => x.id === entry.candidateId); return <div className="tr" key={entry.id}><span>{c?.name || 'Candidate'}</span><span>{c?.sourceProfiles.length || 0}</span><span>{c?.fitScore}</span><span>{entry.notes}</span></div>; })}</div>}</Card>; }
function AISynthesis() { const { sourcedCandidates, selectedCandidateId, synthesizeCandidate, aiSettings, setAIProvider, synthesisPrompt } = useSourcingStore(); const candidate = sourcedCandidates.find(c => c.id === selectedCandidateId) || sourcedCandidates[0]; return <div className="grid split"><Card title="AI Synthesis Layer" eyebrow="V15.8 local-first, BYOK prompt-ready"><label>Provider mode</label><select value={aiSettings.provider} onChange={e => setAIProvider(e.target.value as typeof aiSettings.provider)}><option value="local_only">local_only rule-based</option><option value="openai_prompt_ready">OpenAI prompt-ready</option><option value="claude_prompt_ready">Claude prompt-ready</option></select><div className="guardrail">No API key is required or stored for this recovery build. The app generates local synthesis and a safe prompt you can paste into a BYOK server/backend later.</div>{candidate ? <button onClick={() => synthesizeCandidate(candidate.id)}>Generate synthesis for {candidate.name}</button> : <p>No candidate selected.</p>}{synthesisPrompt && <CodeBox label="Safe synthesis prompt" text={synthesisPrompt} />}</Card><Card title="Candidate synthesis output" eyebrow="Facts separated from inference">{candidate?.synthesis ? <><h3>Facts</h3><List items={candidate.synthesis.facts} /><h3>Inferences</h3><List items={candidate.synthesis.inferences} /><h3>Conflicts</h3><List items={candidate.synthesis.conflicts.length ? candidate.synthesis.conflicts : ['No conflicts captured yet.']} /><h3>HM pitch</h3><p>{candidate.synthesis.hmPitch}</p><h3>Outreach angle</h3><p>{candidate.synthesis.outreachAngle}</p><h3>Verify next</h3><List items={candidate.synthesis.verifyNext} /></> : <p>Generate a synthesis from Candidate 360 or Source Results.</p>}</Card></div>; }
function Memory() { const { projectMemory, feedbackEvents, runRediscovery, sourcedCandidates } = useSourcingStore(); return <div className="grid split"><Card title="Project Memory" eyebrow="V15.9 local learning layer" actions={<button onClick={runRediscovery} disabled={!sourcedCandidates.length}>Run Rediscovery</button>}><h3>Positive patterns</h3><List items={projectMemory.positivePatterns.length ? projectMemory.positivePatterns : ['No positive patterns yet. Add feedback on candidates.']} /><h3>Negative patterns</h3><List items={projectMemory.negativePatterns.length ? projectMemory.negativePatterns : ['No negative patterns yet.']} /><h3>Caution patterns</h3><List items={projectMemory.cautionPatterns.length ? projectMemory.cautionPatterns : ['No caution patterns yet.']} /><h3>Rediscovery notes</h3><List items={projectMemory.rediscoveryNotes} /></Card><Card title="Feedback Events" eyebrow="Human judgment trains the local project">{feedbackEvents.length === 0 ? <p>No feedback yet. Add feedback from candidate result cards.</p> : <div className="timeline">{feedbackEvents.map(f => <div key={f.id}><strong>{f.label}</strong><span>{f.note || 'No note'} · {new Date(f.createdAt).toLocaleString()}</span></div>)}</div>}</Card></div>; }
function Connectors() { const tone = (status: ConnectorStatus) => status === 'connected' ? 'good' : status === 'blocked' ? 'danger' : status === 'evidence_only' ? 'blue' : status === 'manual_only' ? 'warn' : 'neutral'; return <Card title="10–20 Source Connector Registry" eyebrow="Official public APIs + compliant manual workflows"><div className="connector-grid">{connectors.map(c => <div className="connector" key={c.id}><div><strong>{c.name}</strong><Pill tone={tone(c.status)}>{c.status}</Pill><Pill>{c.priority}</Pill></div><p>{c.safeUse}</p><small>{c.guardrail}</small></div>)}</div></Card>; }
function Roadmap() { return <div className="grid three"><Card title="V15.6.1 Stability + UX" eyebrow="Built"><List items={['Cleaner flow QA','Candidate cards with feedback','Contact/merge warnings visible','Stronger Candidate 360 layout']} /></Card><Card title="V15.7 10-source pack" eyebrow="Built"><List items={['GitHub','Stack Overflow','OpenAlex','Hugging Face','npm','PyPI','ORCID','Semantic Scholar','DBLP registry','Docker Hub planned/manual-safe']} /></Card><Card title="V15.8 + V15.9" eyebrow="Built"><List items={['Local rule-based candidate synthesis','Prompt-ready LLM handoff','Facts vs inference split','Project memory','Rediscovery re-ranking','Feedback learning loop']} /></Card></div>; }

function CoreCockpit() { const { activeTab } = useSourcingStore(); return <main><Header /><CommandBar /><Nav /><section className="tab-body">{activeTab === 'intake' && <IntakeMarketMap />}{activeTab === 'results' && <SourceResults />}{activeTab === 'candidate' && <Candidate360 />}{activeTab === 'pipeline' && <Pipeline />}{activeTab === 'ai' && <AISynthesis />}{activeTab === 'memory' && <Memory />}{activeTab === 'connectors' && <Connectors />}{activeTab === 'roadmap' && <Roadmap />}</section></main>; }


type PublicView = 'vault' | 'tools' | 'beta' | 'boolean' | 'xray' | 'jd' | 'methods' | 'directory' | 'blog' | 'article' | 'comparisons' | 'playbooks' | 'waitlist' | 'analytics';
type SetPublicView = (v: PublicView) => void;
type ArticleGuide = { slug: string; title: string; category: string; intent: string; summary: string; keywords: string[]; sections: string[]; workflow: string[]; toolStack: string[]; faq: [string,string][]; ctaView: PublicView; cta: string };
type PublicTool = { name: string; desc: string; path: string; view: PublicView; cta: string };

type AnalyticsEvent = { type: string; label: string; path: string; time: string };
const pathMap: Record<Exclude<PublicView,'article'>, string> = {
  vault: '/',
  tools: '/tools',
  beta: '/beta',
  boolean: '/tools/boolean-generator',
  xray: '/tools/xray-search',
  jd: '/tools/jd-search-strategy',
  methods: '/methods',
  directory: '/directory',
  blog: '/blog',
  comparisons: '/comparisons',
  playbooks: '/playbooks',
  waitlist: '/waitlist',
  analytics: '/admin/analytics'
};
function viewFromLocation(): PublicView {
  if (typeof window === 'undefined') return 'vault';
  const params = new URLSearchParams(window.location.search);
  const forced = params.get('view') as PublicView | null;
  if (forced) return forced;
  const p = window.location.pathname.toLowerCase();
  if (p.includes('/beta')) return 'beta';
  if (p.includes('/tools/boolean')) return 'boolean';
  if (p.includes('/tools/xray')) return 'xray';
  if (p.includes('/tools/jd')) return 'jd';
  if (p === '/tools' || p === '/tools/') return 'tools';
  if (p.includes('/methods')) return 'methods';
  if (p.includes('/directory')) return 'directory';
  if (p.includes('/comparisons')) return 'comparisons';
  if (p.includes('/playbooks')) return 'playbooks';
  if (p.includes('/waitlist')) return 'waitlist';
  if (p.includes('/admin/analytics')) return 'analytics';
  if (p.includes('/blog/') && p.length > 7) return 'article';
  if (p.includes('/blog')) return 'blog';
  return 'vault';
}
function analyticsPath(view: PublicView, articleSlug?: string) { return view === 'article' ? `/blog/${articleSlug || articleGuides[0].slug}` : pathMap[view] || '/'; }
function trackEvent(type: string, label: string) {
  if (typeof window === 'undefined') return;
  const event: AnalyticsEvent = { type, label, path: window.location.pathname + window.location.search, time: new Date().toISOString() };
  const prior = JSON.parse(localStorage.getItem('sourcingos.analytics') || '[]') as AnalyticsEvent[];
  localStorage.setItem('sourcingos.analytics', JSON.stringify([...prior.slice(-199), event]));
}

function upsertMeta(name: string, content: string) {
  if (typeof document === 'undefined') return;
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) { el = document.createElement('meta'); el.setAttribute('name', name); document.head.appendChild(el); }
  el.setAttribute('content', content);
}
function upsertCanonical(path: string) {
  if (typeof document === 'undefined') return;
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) { el = document.createElement('link'); el.setAttribute('rel', 'canonical'); document.head.appendChild(el); }
  el.setAttribute('href', `${window.location.origin}${path}`);
}
function metaFor(view: PublicView, articleSlug?: string) {
  const guide = articleSlug ? articleGuides.find(g => g.slug === articleSlug) : undefined;
  if (view === 'article' && guide) return { title: `${guide.title} | SourcingOS`, description: guide.summary, path: `/blog/${guide.slug}` };
  const map: Record<PublicView, { title: string; description: string; path: string }> = {
    vault: { title: 'SourcingOS | Free Sourcing Tools for Hard-to-Fill Roles', description: 'Free Boolean, X-Ray, JD strategy, sourcing methods, recruiting tool directory, and private beta access for senior sourcers.', path: '/' },
    tools: { title: 'Free Sourcing Tools | SourcingOS', description: 'Use BooleanOS, X-Ray Launcher, and JD Search Strategy tools for technical, cleared, cyber, healthcare, and AI/ML sourcing.', path: '/tools' },
    boolean: { title: 'BooleanOS Free Boolean Generator | SourcingOS', description: 'Generate role-specific Boolean and X-Ray search strings for cleared, cyber, AI/ML, healthcare, and technical sourcing.', path: '/tools/boolean-generator' },
    xray: { title: 'X-Ray Search Launcher for Recruiters | SourcingOS', description: 'Launch Google X-Ray searches for LinkedIn public profiles, GitHub, resumes, PDFs, and target-company pages.', path: '/tools/xray-search' },
    jd: { title: 'JD Search Strategy Tool | SourcingOS', description: 'Turn messy job descriptions into sourcing lanes, target titles, evidence signals, and search strategy.', path: '/tools/jd-search-strategy' },
    methods: { title: 'Sourcing Methods Library | SourcingOS', description: 'Browse source-pack methods for cleared, cyber, AI/ML, healthcare, GitHub, X-Ray, and hard-to-fill searches.', path: '/methods' },
    directory: { title: 'Recruiting Tool Directory | SourcingOS', description: 'Compare sourcing tools, contact finders, AI sourcing platforms, job boards, public evidence sources, and ATS/CRM tools.', path: '/directory' },
    blog: { title: 'SourcingOS Blog | Senior Sourcer Playbooks', description: 'Tactical sourcing guides, Boolean libraries, X-Ray strings, source packs, and recruiting tool comparisons.', path: '/blog' },
    comparisons: { title: 'Recruiting Tool Comparisons | SourcingOS', description: 'Practical sourcer-written comparisons of LinkedIn Recruiter alternatives, hireEZ, SeekOut, Juicebox, contact finders, and sourcing stacks.', path: '/comparisons' },
    playbooks: { title: 'Source Pack Playbooks | SourcingOS', description: 'Role-specific source packs for cleared DevSecOps, cybersecurity, AI/ML, nursing, healthcare IT, and data engineering.', path: '/playbooks' },
    waitlist: { title: 'Join the SourcingOS Private Beta', description: 'Request access to the SourcingOS sourcing cockpit with Candidate 360, Evidence Matrix, project memory, synthesis, and rediscovery.', path: '/waitlist' },
    beta: { title: 'SourcingOS Core Private Beta', description: 'Invite-only SourcingOS Core preview. Candidate 360, source connectors, synthesis, evidence matrix, memory, and rediscovery.', path: '/beta' },
    analytics: { title: 'SourcingOS Admin Analytics', description: 'Internal local analytics dashboard for launch testing.', path: '/admin/analytics' },
    article: { title: 'SourcingOS Guide', description: 'SourcingOS tactical sourcing guide.', path: '/blog' }
  };
  return map[view] || map.vault;
}


const vaultTools: PublicTool[] = [
  { name:'BooleanOS', desc:'Role intake, must-have extraction, Boolean generation, and X-Ray launch guidance.', path:'Public free tool layer', view:'boolean', cta:'Open BooleanOS' },
  { name:'X-Ray Launcher', desc:'Google, LinkedIn profile, GitHub, resume PDF, and company-targeted search lanes.', path:'Tools / X-Ray', view:'xray', cta:'Launch X-Ray tool' },
  { name:'JD Search Strategy', desc:'Turn messy reqs into search lanes, pool risk, title maps, and calibration questions.', path:'Tools / JD Strategy', view:'jd', cta:'Build strategy' },
  { name:'Sourcing Methods Library', desc:'Tactical sourcing methods for cleared, cyber, AI/ML, healthcare IT, nursing, and data roles.', path:'Vault / Methods', view:'methods', cta:'Browse methods' },
  { name:'Recruiting Tool Directory', desc:'Contact finders, source databases, Chrome extensions, ATS/CRM tools, and public evidence sources.', path:'Vault / Directory', view:'directory', cta:'Open directory' },
  { name:'SEO Guide Engine', desc:'High-intent guides, comparisons, alternatives pages, and role-specific Boolean libraries.', path:'Vault / Blog', view:'blog', cta:'See guides' }
];

const articleGuides: ArticleGuide[] = [
  {
    "slug": "cleared-devsecops-sourcing-playbook",
    "title": "How to Source Cleared DevSecOps Engineers: The Complete GovCon Sourcing Playbook",
    "category": "Tier 1 / GovCon Playbook",
    "intent": "GovCon recruiters need a clearance-safe way to break a brutal DevSecOps search into evidence lanes, donor companies, title families, and verification steps.",
    "summary": "The flagship SourcingOS GovCon guide: cleared DevSecOps source lanes, donor companies, Boolean strings, GitHub evidence, HM tradeoffs, and clearance-safe guardrails.",
    "keywords": [
      "source cleared DevSecOps engineers",
      "GovCon DevSecOps recruiter guide",
      "TS/SCI sourcing",
      "AWS GovCloud"
    ],
    "sections": [
      "Why cleared DevSecOps is different",
      "Clearance breadcrumbs vs verified clearance",
      "Five-lane source strategy",
      "GovCon donor-company map",
      "Copy-paste Boolean and X-Ray strings",
      "Hiring-manager market reality memo",
      "Verification before submission"
    ],
    "workflow": [
      "Separate the role into three constraints: DevSecOps stack, federal delivery environment, and clearance or eligibility language.",
      "Build a donor-company lane around GDIT, Leidos, Booz Allen, SAIC, CACI, Peraton, ManTech, Northrop Grumman, Lockheed Martin, RTX, L3Harris, BAE Systems, Palantir, and Anduril.",
      "Run strict, adjacent-title, GitHub-evidence, ATS-rediscovery, and manual authorized clearance-board lanes as separate searches.",
      "Use GitHub as technical evidence only and never as clearance evidence.",
      "Bring the HM a realistic strict-market vs expanded-market tradeoff before burning the whole week on one impossible string."
    ],
    "toolStack": [
      "BooleanOS cleared mode",
      "X-Ray Launcher",
      "JD Strategy Tool",
      "SourcingOS Candidate 360",
      "Project memory and rediscovery"
    ],
    "faq": [
      [
        "Can public text verify active clearance?",
        "No. Treat public clearance language as a breadcrumb only and verify through approved recruiter processes."
      ],
      [
        "What should I loosen first?",
        "Loosen title family and donor-company constraints before loosening true must-have security/cloud skills."
      ],
      [
        "Why publish this first?",
        "It is highly specific, hard to find elsewhere, and maps directly to the default SourcingOS demo workflow."
      ]
    ],
    "ctaView": "boolean",
    "cta": "Generate cleared DevSecOps strings"
  },
  {
    "slug": "cybersecurity-boolean-strings-library",
    "title": "30 Boolean Search Strings for Cybersecurity Recruiters: ISSO, ISSM, SOC Analyst, Pen Tester, and More",
    "category": "Tier 1 / Boolean Library",
    "intent": "Cyber recruiters need role-specific strings that separate RMF, ISSO, SOC, AppSec, pen testing, vulnerability, and cleared cyber markets instead of mixing them into one noisy search.",
    "summary": "A screenshot- and bookmark-friendly cyber Boolean library organized by role family, source, clearance variant, and false-positive filters.",
    "keywords": [
      "boolean search strings cybersecurity recruiter",
      "ISSO recruiter boolean",
      "cyber boolean strings recruiting"
    ],
    "sections": [
      "Why cybersecurity Boolean is harder",
      "Role families and title chaos",
      "ISSO and ISSM strings",
      "SOC and incident response strings",
      "Pen testing and AppSec strings",
      "RMF and vulnerability strings",
      "Cleared variants and exclusions"
    ],
    "workflow": [
      "Split cyber into RMF/GRC, SOC/IR, AppSec, pen testing, cloud security, IAM, and product security lanes.",
      "Build title variants first, then add tools, frameworks, certifications, clearance breadcrumbs, and location filters.",
      "Use certifications as filters, not as proof of hands-on depth.",
      "Track false positives such as students, bootcamps, trainers, vendors, help desk, and general IT support.",
      "Feed new exclusions back into SourcingOS memory after every reject."
    ],
    "toolStack": [
      "BooleanOS cyber templates",
      "X-Ray Launcher",
      "NVD/CISA KEV context",
      "Candidate 360 evidence matrix"
    ],
    "faq": [
      [
        "Why not publish a generic Boolean cheat sheet?",
        "Generic Boolean is saturated. Role-specific cyber strings have a clearer gap and stronger product fit."
      ],
      [
        "What is the biggest cyber sourcing mistake?",
        "Searching for broad cybersecurity terms instead of splitting by work type."
      ],
      [
        "Where should the CTA go?",
        "Directly into BooleanOS with a cyber preloaded example."
      ]
    ],
    "ctaView": "boolean",
    "cta": "Build cyber Boolean"
  },
  {
    "slug": "source-pack-methodology",
    "title": "The Source Pack: How to Structure a Multi-Lane Search Before You Touch LinkedIn",
    "category": "Tier 1 / SourcingOS Framework",
    "intent": "Senior sourcers need a named methodology for planning searches before running strings, and SourcingOS needs a public article that explains its core worldview.",
    "summary": "The foundational SourcingOS article: source packs, search lanes, pool-size thinking, false-positive rules, donor companies, evidence standards, and learning loops.",
    "keywords": [
      "sourcing strategy template",
      "search lanes recruiting",
      "source pack recruiting",
      "how to plan a sourcing search"
    ],
    "sections": [
      "Why single-lane sourcing fails",
      "What a source pack includes",
      "The five standard source lanes",
      "Pool-size estimation",
      "Stop rules by lane",
      "Source pack template",
      "Examples by role"
    ],
    "workflow": [
      "Define the strict market: must-haves, location, clearance/licensure, seniority, compensation, and donor companies.",
      "Define the expanded market: adjacent titles, transferable tools, parallel industries, and geography/seniority tradeoffs.",
      "Choose lanes by evidence type: professional profile, code evidence, publication evidence, licensure evidence, ATS rediscovery, and contact enrichment.",
      "Set stop rules so you know when a lane is exhausted instead of endlessly tweaking one query.",
      "Save positive, negative, and caution patterns back into project memory."
    ],
    "toolStack": [
      "JD Strategy Tool",
      "BooleanOS",
      "X-Ray Launcher",
      "Methods Library",
      "SourcingOS project memory"
    ],
    "faq": [
      [
        "What is a source pack?",
        "A reusable search strategy packet defining who to search, where to search, what evidence matters, and what to avoid."
      ],
      [
        "Why is this foundational?",
        "It explains the product logic behind SourcingOS better than a feature list."
      ],
      [
        "What article should link here?",
        "Every role-specific playbook should link back to the source-pack methodology."
      ]
    ],
    "ctaView": "methods",
    "cta": "Open methods library"
  },
  {
    "slug": "github-xray-25-strings",
    "title": "GitHub X-Ray Sourcing: 25 Copy-Paste Strings for DevSecOps, AI/ML, Cloud, and Systems Engineers",
    "category": "Tier 1 / X-Ray Library",
    "intent": "Technical recruiters want launchable GitHub searches and a practical way to evaluate public code evidence without pretending GitHub is a resume database.",
    "summary": "A GitHub X-Ray library with role-specific strings for DevSecOps, AI/ML, cloud, systems, frontend, full-stack, package evidence, and security profiles.",
    "keywords": [
      "GitHub X-Ray sourcing recruiters",
      "site:github.com boolean strings",
      "how to source engineers on GitHub"
    ],
    "sections": [
      "Why GitHub matters now",
      "What site:github.com can and cannot find",
      "Profile vs repo evidence",
      "Role-specific strings",
      "False positives",
      "GitHub plus Stack Overflow",
      "Contact provenance"
    ],
    "workflow": [
      "Use role and skill clusters as separate query lanes instead of one giant string.",
      "Search for profile evidence, repo README evidence, package evidence, topic tags, and organization context separately.",
      "Filter tutorial repos, fork-only profiles, inactive profiles, org accounts, and student projects.",
      "Pair GitHub evidence with Stack Overflow, package registries, OpenAlex, or manual profile review before merging.",
      "Launch searches through X-Ray Launcher and save good strings into methods."
    ],
    "toolStack": [
      "X-Ray Launcher",
      "GitHub connector",
      "Stack Overflow connector",
      "npm/PyPI/Hugging Face package evidence",
      "Evidence Matrix"
    ],
    "faq": [
      [
        "Is GitHub sourcing compliant?",
        "Use only public pages responsibly, do not scrape restricted surfaces, and treat GitHub as evidence rather than employment intent."
      ],
      [
        "What is the strongest GitHub signal?",
        "Recent original work relevant to the target stack, not stars alone."
      ],
      [
        "Should this support the free tool launch?",
        "Yes. It is the flagship companion post for X-Ray Launcher."
      ]
    ],
    "ctaView": "xray",
    "cta": "Launch GitHub X-Ray"
  },
  {
    "slug": "registered-nurse-sourcing-playbook",
    "title": "How to Source Registered Nurses: A Recruiter\u2019s Sourcing Playbook for Thin-Market Healthcare Hiring",
    "category": "Tier 1 / Healthcare Playbook",
    "intent": "Healthcare recruiters need a repeatable system for RN and allied health sourcing beyond job boards, referral bonuses, and generic nursing-shortage advice.",
    "summary": "A healthcare sourcing playbook covering RN source lanes, specialty differences, NPI-aware searching, credentials, outreach timing, and burnout-sensitive messaging.",
    "keywords": [
      "how to source registered nurses",
      "nursing recruiter sourcing strategies",
      "RN sourcing playbook"
    ],
    "sections": [
      "Why post-and-pray is dead",
      "Nursing source lanes",
      "Credential and specialty signals",
      "NPI and public registries",
      "Specialty-by-specialty sourcing",
      "Travel nurse conversion",
      "Burnout-sensitive outreach"
    ],
    "workflow": [
      "Segment nurse searches by specialty, shift, licensure, geography, setting, and career motivation.",
      "Use job boards, LinkedIn, state license lookups, NPI, clinical associations, alumni networks, and hospital donor maps as separate lanes.",
      "Differentiate ICU, OR, ER, L&D, NICU, home health, case management, and allied health personas.",
      "Use credential filters carefully: BSN, BLS, ACLS, CCRN, CNOR, CRNFA, Epic, EMR, and specialty terms.",
      "Write outreach that acknowledges workload, commute, shift, pay, patient population, and schedule reality."
    ],
    "toolStack": [
      "JD Strategy Tool healthcare mode",
      "Source pack builder",
      "X-Ray Launcher",
      "NPI Registry connector",
      "SourcingOS beta waitlist"
    ],
    "faq": [
      [
        "Why include healthcare early?",
        "It proves SourcingOS is not only for software roles and speaks to a major hard-to-fill market."
      ],
      [
        "Is NPI a candidate database?",
        "No. It is public provider data that requires careful, relevant, ethical use."
      ],
      [
        "What makes RN sourcing different?",
        "Location, schedule, burnout, setting, specialty, and licensure matter more than generic keyword matching."
      ]
    ],
    "ctaView": "jd",
    "cta": "Build a nurse source pack"
  },
  {
    "slug": "free-linkedin-recruiter-alternatives",
    "title": "Free LinkedIn Recruiter Alternatives That Actually Work: A Sourcer\u2019s Honest Assessment",
    "category": "Tier 1 / Comparison",
    "intent": "Recruiters, small agencies, and lean teams want to know how to replace or supplement an expensive LinkedIn Recruiter seat without buying a worse stack.",
    "summary": "A practitioner-first LinkedIn Recruiter alternatives guide focused on what each replacement actually replaces: search, projects, outreach, insights, and contact data.",
    "keywords": [
      "LinkedIn Recruiter alternatives free",
      "LinkedIn Recruiter too expensive alternatives",
      "free sourcing tools recruiters"
    ],
    "sections": [
      "What LinkedIn Recruiter actually does",
      "What it does poorly",
      "Free search alternatives",
      "Open-web technical stack",
      "Contact data and outreach gaps",
      "When paid tools make sense",
      "A practical under-$300/month stack"
    ],
    "workflow": [
      "Separate LinkedIn Recruiter into jobs: search, projects, InMail, insights, filters, and team workflow.",
      "Replace search with BooleanOS, Google X-Ray, GitHub, Stack Overflow, OpenAlex, NPI, and authorized niche sources.",
      "Replace tool discovery with the SourcingOS directory and workflow notes.",
      "Use paid enrichment only where public search stops being enough.",
      "Use SourcingOS as the cockpit to organize the stack, source packs, and candidate evidence."
    ],
    "toolStack": [
      "BooleanOS",
      "X-Ray Launcher",
      "Tool Directory",
      "GitHub",
      "Stack Overflow",
      "OpenAlex",
      "ContactOut/Apollo/Lusha/RocketReach"
    ],
    "faq": [
      [
        "Can free tools fully replace LinkedIn Recruiter?",
        "Not fully for every team, but they can replace or supplement large parts of search strategy and open-web sourcing."
      ],
      [
        "Why is this different from vendor comparisons?",
        "It is written from the sourcer workflow perspective instead of steering every answer to one vendor."
      ],
      [
        "Where should readers go next?",
        "Tool Directory for alternatives and beta waitlist for the full cockpit."
      ]
    ],
    "ctaView": "directory",
    "cta": "Open tool directory"
  },
  {
    "slug": "senior-sourcer-chatgpt-prompts",
    "title": "50 ChatGPT Prompts That Actually Work for Senior Sourcers",
    "category": "Tier 1 / Prompt Library",
    "intent": "Recruiters want prompts that go beyond job descriptions and outreach emails into real sourcing diagnosis, Boolean strategy, market mapping, and HM calibration.",
    "summary": "A practical prompt library for senior sourcers: JD deconstruction, source lanes, false positives, market maps, HM calibration, search diagnosis, and outreach angles.",
    "keywords": [
      "ChatGPT prompts for sourcers",
      "AI prompts technical recruiting",
      "ChatGPT boolean search recruiting"
    ],
    "sections": [
      "Why generic recruiting prompts fail",
      "Role-analysis prompts",
      "Boolean and X-Ray prompts",
      "Market-map prompts",
      "HM calibration prompts",
      "Search diagnosis prompts",
      "Outreach personalization prompts"
    ],
    "workflow": [
      "Give the model the role context, constraints, must-haves, unacceptable false positives, and target market before asking for output.",
      "Ask for source lanes before asking for one Boolean string.",
      "Ask for adjacent titles and donor companies as separate lists.",
      "Ask for why a search might fail, what to loosen first, and what to verify before submission.",
      "Use SourcingOS to productize the workflow instead of re-prompting from scratch every time."
    ],
    "toolStack": [
      "JD Strategy Tool",
      "BooleanOS",
      "Outreach angle generator",
      "SourcingOS AI synthesis",
      "Beta waitlist"
    ],
    "faq": [
      [
        "What is wrong with \u201cwrite a Boolean string\u201d?",
        "It skips market context, title variants, source lanes, false positives, and tradeoffs."
      ],
      [
        "Should recruiters trust AI prompts blindly?",
        "No. Treat prompts as strategy support, not as final candidate evaluation."
      ],
      [
        "Why is this shareable?",
        "Prompt libraries get bookmarked, screenshotted, and shared by recruiters who need immediate utility."
      ]
    ],
    "ctaView": "jd",
    "cta": "Try JD Strategy Tool"
  },
  {
    "slug": "contact-finder-comparison-recruiters",
    "title": "ContactOut vs Lusha vs Apollo vs Swordfish: A Recruiter\u2019s Real-World Contact Finder Comparison",
    "category": "Tier 2 / Tool Comparison",
    "intent": "Recruiters evaluating contact finders need the difference between personal email coverage, work email coverage, phone data, cost per reveal, workflow fit, and compliance posture.",
    "summary": "A recruiter-first contact finder comparison that explains where each enrichment tool fits in a sourcing workflow and how to build a contact waterfall.",
    "keywords": [
      "ContactOut vs Lusha",
      "best contact finder for recruiters",
      "Apollo vs Lusha recruiters",
      "Swordfish recruiter comparison"
    ],
    "sections": [
      "What you are actually comparing",
      "Personal vs work email",
      "Phone-first outreach",
      "Credit cost and reveal logic",
      "Recruiter use cases",
      "Compliance and opt-out notes",
      "Contact waterfall workflow"
    ],
    "workflow": [
      "Choose the tool based on candidate type, geography, outreach channel, and compliance requirements.",
      "Use a waterfall: existing ATS/CRM, profile email, verified work email, personal email where appropriate, phone only where policy allows.",
      "Store source provenance and never let enrichment become an unsupported candidate claim.",
      "Respect opt-outs, DNC, and local laws.",
      "Use SourcingOS Candidate 360 to separate contact signals from fit evidence."
    ],
    "toolStack": [
      "Tool Directory",
      "ContactOut",
      "Lusha",
      "Apollo",
      "RocketReach",
      "Swordfish",
      "Candidate 360 contact signals"
    ],
    "faq": [
      [
        "Which contact tool is best?",
        "It depends on whether you need personal email, work email, phone data, volume, or workflow integration."
      ],
      [
        "Should contact data affect fit score?",
        "No. Contactability is separate from role fit."
      ],
      [
        "Why not auto-email?",
        "SourcingOS should draft and organize outreach, but human approval is required before sending."
      ]
    ],
    "ctaView": "directory",
    "cta": "Compare contact tools"
  },
  {
    "slug": "ninety-day-open-req-rescue",
    "title": "The 90-Day Open Req Rescue: A Step-by-Step Search Reset Playbook",
    "category": "Tier 2 / Rescue Playbook",
    "intent": "Recruiters with stalled reqs need a diagnosis workflow, not motivational advice or more random sourcing activity.",
    "summary": "A practical recovery plan for aging requisitions: diagnose the failure, rebuild the source pack, reframe HM tradeoffs, relaunch lanes, and measure what changes.",
    "keywords": [
      "how to fill hard to fill positions",
      "aging requisition strategy",
      "req open 90 days what to do"
    ],
    "sections": [
      "The three causes of aging reqs",
      "Req audit checklist",
      "HM reset conversation",
      "Lane switching",
      "Pool audit",
      "Outreach reset",
      "When to escalate"
    ],
    "workflow": [
      "Stop sourcing and diagnose whether the failure is intake, market, comp, location, manager calibration, outreach, or process speed.",
      "Rebuild the ICP and source pack from scratch rather than tweaking the same dead query.",
      "Create three new lanes: adjacent title, donor company, and rediscovery/silver-medalist.",
      "Bring the HM a strict-market vs expanded-market memo.",
      "Track the new test for seven days and decide whether to escalate or expand."
    ],
    "toolStack": [
      "JD Strategy Tool",
      "Source pack builder",
      "Project memory",
      "Rediscovery re-ranking",
      "HM memo generator"
    ],
    "faq": [
      [
        "When is a req truly impossible?",
        "When strict constraints, compensation, location, and supply data all show the same bottleneck after multiple lanes are tested."
      ],
      [
        "What should change first?",
        "Usually title variants, location, seniority, or must-have stack assumptions before lowering quality standards."
      ],
      [
        "Why is this good content?",
        "Every recruiter has a painful zombie req and needs a usable reset playbook."
      ]
    ],
    "ctaView": "jd",
    "cta": "Run a req reset"
  },
  {
    "slug": "how-to-read-github-profile-recruiters",
    "title": "How to Read a GitHub Profile: A Non-Technical Recruiter\u2019s Guide to Technical Evidence",
    "category": "Tier 1 / Evidence Guide",
    "intent": "Non-technical recruiters need to know what GitHub signals mean, what they do not mean, and how to avoid over-claiming technical evidence.",
    "summary": "A recruiter-friendly GitHub evidence guide: repos, stars, forks, recency, contribution graph, topics, README quality, contact clues, and false positives.",
    "keywords": [
      "how to evaluate github profile recruiter",
      "what to look for on github recruiting",
      "GitHub profile recruiting guide"
    ],
    "sections": [
      "GitHub is not a resume",
      "Profile anatomy",
      "Repo quality signals",
      "Red flags",
      "Language and topic signals",
      "Contribution history",
      "Contact clues",
      "Two-source evidence check"
    ],
    "workflow": [
      "Start with profile context: bio, location, linked site, pinned repos, organizations, and recent activity.",
      "Review original repos before forked repos.",
      "Check recency, README quality, issues, topics, stars, forks, package links, and language mix.",
      "Avoid overvaluing tutorial projects, abandoned repos, and inflated stars.",
      "Combine GitHub with Stack Overflow, package registries, LinkedIn/manual profile text, or ATS evidence before merging."
    ],
    "toolStack": [
      "X-Ray Launcher",
      "GitHub connector",
      "Evidence Matrix",
      "Candidate 360",
      "Profile linking guardrails"
    ],
    "faq": [
      [
        "Do stars prove quality?",
        "No. Stars are one signal. Relevance, recency, originality, and project context matter more."
      ],
      [
        "Can I infer seniority from GitHub alone?",
        "No. Use GitHub as supporting evidence, not as a complete assessment."
      ],
      [
        "Why should non-technical recruiters read this?",
        "It helps them ask better questions and avoid weak evidence claims."
      ]
    ],
    "ctaView": "xray",
    "cta": "Open GitHub X-Ray"
  },
  {
    "slug": "seekout-vs-hireez-vs-juicebox-linkedin",
    "title": "SeekOut vs hireEZ vs Juicebox vs LinkedIn Recruiter: An Honest Sourcer\u2019s Take",
    "category": "Tier 2 / Commercial Comparison",
    "intent": "TA leaders and sourcers evaluating sourcing platforms need scenario-based tradeoffs rather than vendor-written feature lists.",
    "summary": "A sourcer-written comparison of major sourcing platforms by search depth, data coverage, outreach, workflow fit, pricing posture, and best-use scenarios.",
    "keywords": [
      "SeekOut vs hireEZ",
      "hireEZ vs Juicebox",
      "LinkedIn Recruiter alternative comparison",
      "AI sourcing tool comparison"
    ],
    "sections": [
      "The vendor comparison problem",
      "Scenario-based scorecard",
      "Technical sourcing",
      "Cleared/GovCon sourcing",
      "Healthcare and volume hiring",
      "Outreach and CRM workflow",
      "Where SourcingOS fits"
    ],
    "workflow": [
      "Compare platforms by sourcing scenario rather than feature list.",
      "Score search depth, evidence transparency, contact data, outreach workflow, team adoption, and cost.",
      "Call out where each tool wins and where it is overkill.",
      "Position SourcingOS as the neutral cockpit that organizes strategy and evidence across tools.",
      "Link every tool to the directory instead of burying the comparison in one page."
    ],
    "toolStack": [
      "Tool Directory",
      "Comparison Engine",
      "SourcingOS beta cockpit",
      "BooleanOS",
      "X-Ray Launcher"
    ],
    "faq": [
      [
        "Which platform wins?",
        "It depends on role type, team size, budget, required sources, and whether you need outreach automation or search intelligence."
      ],
      [
        "Why write this later?",
        "It has high traffic but requires more research and careful updates."
      ],
      [
        "What is the conversion path?",
        "Comparison page to tool directory to beta waitlist."
      ]
    ],
    "ctaView": "comparisons",
    "cta": "Open comparison engine"
  },
  {
    "slug": "govcon-company-map-cleared-talent",
    "title": "The GovCon Company Map: Where Cleared Technical Talent Actually Lives",
    "category": "Tier 2 / Reference Map",
    "intent": "Cleared recruiters need donor-company logic: which primes, subcontractors, and mission contractors produce specific technical talent pools.",
    "summary": "A reference map of GovCon donor companies and how to use them in sourcing lanes for cloud, cyber, systems, data, mission, and cleared technical roles.",
    "keywords": [
      "GovCon company list technical recruiters",
      "cleared talent donor companies sourcing",
      "defense contractor talent map"
    ],
    "sections": [
      "Why donor companies matter",
      "Prime contractor map",
      "Subcontractor layer",
      "Role-by-company patterns",
      "Location clusters",
      "Search strings by company lane",
      "How to avoid stale assumptions"
    ],
    "workflow": [
      "Start with mission/contract environment before searching one company list.",
      "Map direct donors, adjacent donors, subcontractors, boutiques, and commercial crossover companies.",
      "Separate cyber, cloud, systems, data, AI/ML, and mission support donor lists.",
      "Use company names as context terms, not as the only filter.",
      "Update the donor map based on saved candidates and HM feedback."
    ],
    "toolStack": [
      "JD Strategy Tool",
      "BooleanOS target-company strings",
      "Project memory",
      "GovCon company graph",
      "Beta waitlist"
    ],
    "faq": [
      [
        "Is company history proof of clearance?",
        "No. It is source strategy context only."
      ],
      [
        "Why does this matter?",
        "Donor-company maps help sourcers avoid starting from a blank search."
      ],
      [
        "Should it be a public reference asset?",
        "Yes. It can become one of SourcingOS\u2019s most bookmarked GovCon pages."
      ]
    ],
    "ctaView": "jd",
    "cta": "Build donor-company lane"
  },
  {
    "slug": "hugging-face-sourcing-guide-ai-ml-recruiters",
    "title": "Hugging Face Sourcing Guide for AI/ML Recruiters: Finding ML Engineers in the Open-Source Community",
    "category": "Tier 2 / AI-ML Source Guide",
    "intent": "AI/ML recruiters need to understand how Hugging Face model, dataset, and space evidence differs from GitHub and academic publication evidence.",
    "summary": "A practical Hugging Face sourcing guide for finding ML engineers, MLOps builders, model contributors, researchers, and open-source AI talent.",
    "keywords": [
      "Hugging Face recruiting",
      "how to source AI engineers open source",
      "find ML engineers GitHub Hugging Face"
    ],
    "sections": [
      "Hugging Face vs GitHub",
      "Model cards as evidence",
      "Datasets and spaces",
      "Finding MLOps builders",
      "Researcher vs engineer signals",
      "Combining with OpenAlex",
      "Identity confirmation"
    ],
    "workflow": [
      "Search for models, datasets, spaces, and contributors tied to the target domain.",
      "Read model cards for architecture, benchmarks, dependencies, and contribution depth.",
      "Look for MLOps and deployment signals, not just model uploads.",
      "Pair Hugging Face with GitHub, OpenAlex, arXiv, Kaggle, or personal sites before creating a candidate record.",
      "Never infer job intent from open-source contribution alone."
    ],
    "toolStack": [
      "Hugging Face connector",
      "GitHub connector",
      "OpenAlex connector",
      "AI/ML source pack",
      "Candidate 360"
    ],
    "faq": [
      [
        "Is Hugging Face a candidate database?",
        "No. It is an open-source evidence surface."
      ],
      [
        "What roles does it help with?",
        "ML engineers, MLOps engineers, applied AI engineers, NLP researchers, and model evaluation specialists."
      ],
      [
        "Why is this a gap?",
        "Most AI recruiting content focuses on recruiting tools, not sources of AI talent."
      ]
    ],
    "ctaView": "waitlist",
    "cta": "Join AI/ML beta"
  },
  {
    "slug": "stack-overflow-sourcing-technical-tags",
    "title": "Stack Overflow as a Sourcing Tool: The Recruiter\u2019s Complete Guide to Technical Tag Evidence",
    "category": "Tier 2 / Technical Evidence Guide",
    "intent": "Technical sourcers need a practical way to use Stack Overflow profiles, tags, reputation, and answer patterns as evidence without overinterpreting them.",
    "summary": "A Stack Overflow sourcing guide focused on tag evidence, reputation context, accepted answers, role mapping, and two-source verification with GitHub.",
    "keywords": [
      "Stack Overflow sourcing recruiters",
      "how to use Stack Overflow to find candidates",
      "technical tag evidence recruiting"
    ],
    "sections": [
      "Stack Overflow vs GitHub",
      "What profiles reveal",
      "Tag evidence by role",
      "Reputation and accepted answers",
      "Google X-Ray strings",
      "Two-source verification",
      "False-positive cautions"
    ],
    "workflow": [
      "Use tags as a technical-depth signal, not a complete candidate assessment.",
      "Map tags to roles: Kubernetes, Terraform, Python, React, Spark, security, ML, database, and cloud terms.",
      "Review accepted answers and recency when visible.",
      "Pair Stack Overflow with GitHub or package evidence before merging profiles.",
      "Keep identity matching recruiter-confirmed."
    ],
    "toolStack": [
      "Stack Overflow connector",
      "X-Ray Launcher",
      "GitHub connector",
      "Evidence Matrix",
      "Candidate 360"
    ],
    "faq": [
      [
        "Does reputation equal job fit?",
        "No. Reputation is a context signal, not role fit."
      ],
      [
        "What is the strongest SO use case?",
        "Disambiguating hands-on technical areas through tag evidence."
      ],
      [
        "Why include this page?",
        "It showcases the evidence-first SourcingOS philosophy."
      ]
    ],
    "ctaView": "xray",
    "cta": "Launch Stack Overflow X-Ray"
  },
  {
    "slug": "hiring-manager-intake-sourcing-questions",
    "title": "How to Write a Hiring Manager Intake That Actually Tells You What You Need to Source",
    "category": "Tier 2 / Intake Template",
    "intent": "Recruiters need intake questions that reveal market constraints, must-have tradeoffs, donor companies, and evidence standards instead of vague \u201cideal candidate\u201d notes.",
    "summary": "A sourcing-diagnostic HM intake guide with questions for fillability, must-haves, nice-to-haves, donor companies, tradeoffs, evidence, and search constraints.",
    "keywords": [
      "hiring manager intake questions sourcing",
      "recruiter intake meeting questions",
      "intake call template recruiting"
    ],
    "sections": [
      "Why standard intake fails",
      "Fillability questions",
      "Must-have vs nice-to-have questions",
      "Donor-company questions",
      "Evidence questions",
      "Tradeoff questions",
      "HM memo template"
    ],
    "workflow": [
      "Ask what must be true on day one vs what can be learned.",
      "Ask which companies produce people who have done this work.",
      "Ask which previous candidates were close and why they failed.",
      "Ask what can flex first: location, comp, seniority, title, industry, or stack.",
      "Turn intake notes into a source pack before searching."
    ],
    "toolStack": [
      "JD Strategy Tool",
      "HM tradeoff memo",
      "Source pack builder",
      "SourcingOS beta"
    ],
    "faq": [
      [
        "What is the most important intake question?",
        "What would make you say yes to someone who is missing one listed requirement?"
      ],
      [
        "Why is this a sourcing article?",
        "Great sourcing starts with constraints, evidence standards, and tradeoffs."
      ],
      [
        "Where does this convert?",
        "Directly into the JD Strategy Tool."
      ]
    ],
    "ctaView": "jd",
    "cta": "Run intake through JD Strategy"
  },
  {
    "slug": "openalex-researcher-sourcing-guide",
    "title": "OpenAlex for Technical Recruiters: How to Find Researchers and Applied Scientists You Can\u2019t Find on LinkedIn",
    "category": "Tier 2 / Research Evidence Guide",
    "intent": "Research and AI/ML recruiters need a way to discover authors, publications, concepts, institutions, and related researchers without relying on LinkedIn alone.",
    "summary": "A recruiter-friendly OpenAlex guide for finding researchers, applied scientists, AI/ML authors, institutions, concepts, and publication evidence.",
    "keywords": [
      "OpenAlex recruiter guide",
      "sourcing academic researchers",
      "how to find researchers recruiting"
    ],
    "sections": [
      "Why research sourcing is different",
      "Author search basics",
      "Concept and institution signals",
      "Citation context",
      "Identity collision risks",
      "OpenAlex plus GitHub",
      "Candidate 360 workflow"
    ],
    "workflow": [
      "Start with topic/concept and institution context before name-only searches.",
      "Use author records to identify publication themes, coauthors, institutions, and works.",
      "Avoid auto-merging on name alone because researcher names collide frequently.",
      "Pair OpenAlex with ORCID, Semantic Scholar, GitHub, personal sites, or manual profile evidence.",
      "Use publications as evidence of domain expertise, not job interest."
    ],
    "toolStack": [
      "OpenAlex connector",
      "ORCID connector",
      "Semantic Scholar connector",
      "GitHub connector",
      "Candidate 360"
    ],
    "faq": [
      [
        "Can OpenAlex find candidates?",
        "It can surface public research evidence and authors, but recruiter review is required."
      ],
      [
        "What roles is it best for?",
        "AI/ML, applied science, computational biology, data science, research engineering, and R&D roles."
      ],
      [
        "Why is this valuable?",
        "Almost no recruiter-facing content explains OpenAlex as a sourcing surface."
      ]
    ],
    "ctaView": "waitlist",
    "cta": "Join research sourcing beta"
  },
  {
    "slug": "boolean-search-mistakes-recruiters",
    "title": "The Boolean Search Mistakes That Are Wrecking Your Results and How to Fix Them",
    "category": "Tier 2 / Diagnostic Guide",
    "intent": "Recruiters whose Boolean searches are too broad, too narrow, or too noisy need a diagnostic framework rather than another beginner cheat sheet.",
    "summary": "A diagnostic Boolean guide for fixing noisy, empty, or irrelevant search results through title maps, OR groups, exclusions, source-specific syntax, and lane splitting.",
    "keywords": [
      "boolean search mistakes recruiters",
      "why boolean search not working",
      "fix boolean string recruiting"
    ],
    "sections": [
      "Too many results",
      "Too few results",
      "Wrong candidates",
      "Broken operator logic",
      "Missing title variants",
      "Missing exclusions",
      "When to split lanes"
    ],
    "workflow": [
      "Diagnose whether the failure is title logic, skill logic, source syntax, seniority, location, or false positives.",
      "Use OR groups for synonyms and AND only for true must-haves.",
      "Add NOT exclusions after reviewing real false positives.",
      "Split cyber, AI/ML, healthcare, or GovCon into lanes before stacking everything into one string.",
      "Use BooleanOS to generate balanced, broad, and narrow versions."
    ],
    "toolStack": [
      "BooleanOS",
      "JD Strategy Tool",
      "X-Ray Launcher",
      "Project memory"
    ],
    "faq": [
      [
        "Why does my search return nothing?",
        "Usually too many AND requirements, too few title variants, or source syntax mismatch."
      ],
      [
        "Why does my search return junk?",
        "Usually missing exclusions or over-broad title/skill groups."
      ],
      [
        "What is the CTA?",
        "Run the same role through BooleanOS and compare balanced vs broad vs narrow strings."
      ]
    ],
    "ctaView": "boolean",
    "cta": "Fix a Boolean string"
  },
  {
    "slug": "healthcare-it-sourcing-guide",
    "title": "How to Source Clinical Data Managers, FHIR Developers, and Epic Analysts: Healthcare IT Recruiting Guide",
    "category": "Tier 2 / Healthcare IT Guide",
    "intent": "Healthcare IT recruiters need role-specific source lanes for clinical systems, interoperability, FHIR, HL7, Epic, clinical data, and federal health technology roles.",
    "summary": "A healthcare IT sourcing guide for Epic analysts, FHIR developers, HL7 integration engineers, clinical data managers, and federal health data roles.",
    "keywords": [
      "how to source Epic analyst",
      "FHIR developer recruiting",
      "healthcare IT sourcing guide"
    ],
    "sections": [
      "Healthcare IT role map",
      "Epic analyst search lanes",
      "FHIR and HL7 developer signals",
      "Clinical data manager signals",
      "Federal health tech donor companies",
      "Boolean strings",
      "Compliance cautions"
    ],
    "workflow": [
      "Split clinical systems, interoperability, data, implementation, and analytics roles.",
      "Use Epic, Cerner, Meditech, HL7, FHIR, SMART on FHIR, HIE, EHR, EMR, HIPAA, clinical workflow, and data exchange terms carefully.",
      "Look at health systems, consulting firms, EHR vendors, federal health contractors, and clinical research organizations as donor pools.",
      "Avoid mixing pure clinical and pure software roles unless the JD truly needs both.",
      "Use SourcingOS Healthcare IT mode to create reusable source packs."
    ],
    "toolStack": [
      "Healthcare IT mode",
      "JD Strategy Tool",
      "X-Ray Launcher",
      "NPI/PubMed/ClinicalTrials context",
      "Beta waitlist"
    ],
    "faq": [
      [
        "Why is healthcare IT different?",
        "It blends software, clinical workflows, privacy, integration standards, and domain-specific systems."
      ],
      [
        "Can NPI prove technical fit?",
        "No. It is context for healthcare identity and credential data where relevant."
      ],
      [
        "What is a good first lane?",
        "Epic/FHIR/HL7 title and systems lane, then donor-company lane."
      ]
    ],
    "ctaView": "jd",
    "cta": "Build healthcare IT strategy"
  },
  {
    "slug": "ai-ml-source-pack",
    "title": "AI/ML Sourcing Source Pack: A Complete Search Strategy for ML Engineers, MLOps, and Applied AI",
    "category": "Tier 2 / AI-ML Playbook",
    "intent": "AI/ML recruiters need a source-pack approach that combines GitHub, Hugging Face, OpenAlex, arXiv, papers, model evidence, and production MLOps signals.",
    "summary": "A complete AI/ML source-pack blueprint for ML engineers, MLOps, applied AI engineers, researchers, and LLM platform roles.",
    "keywords": [
      "how to source ML engineers",
      "AI engineer recruiting guide",
      "source machine learning talent",
      "MLOps sourcing"
    ],
    "sections": [
      "AI/ML title chaos",
      "Production vs research signals",
      "Five-source AI talent stack",
      "GitHub and packages",
      "Hugging Face and models",
      "OpenAlex/arXiv publications",
      "Outreach angles"
    ],
    "workflow": [
      "Split ML engineers, MLOps, applied AI, research scientists, data scientists, and AI infrastructure roles.",
      "Identify whether the req needs research depth, production depth, model deployment, data pipeline, evaluation, or infra/GPU optimization.",
      "Use GitHub, Hugging Face, OpenAlex, arXiv, Semantic Scholar, Kaggle, and package registries as separate evidence lanes.",
      "Avoid treating \u201cAI engineer\u201d as a single market.",
      "Save the source pack and update it with HM feedback after each screen."
    ],
    "toolStack": [
      "AI/ML mode",
      "JD Strategy Tool",
      "Hugging Face connector",
      "OpenAlex connector",
      "GitHub connector",
      "Candidate 360"
    ],
    "faq": [
      [
        "Why is AI/ML sourcing hard?",
        "Titles are inconsistent and skills range from research to data plumbing to deployment."
      ],
      [
        "What source matters most?",
        "It depends on whether the role is research, applied ML, MLOps, or AI infrastructure."
      ],
      [
        "Why publish later?",
        "It is high value but requires deeper examples and careful source explanations."
      ]
    ],
    "ctaView": "jd",
    "cta": "Build AI/ML source pack"
  },
  {
    "slug": "data-engineer-sourcing-guide",
    "title": "Sourcing for Data Engineers: Spark, Airflow, dbt, and Snowflake in Thin Markets",
    "category": "Tier 2 / Data Guide",
    "intent": "Recruiters need to identify data engineers by stack, workflow, seniority, and platform evidence rather than generic data title matching.",
    "summary": "A practical data engineering sourcing guide for Spark, Airflow, dbt, Snowflake, Databricks, ETL, data platform, and analytics engineering roles.",
    "keywords": [
      "how to source data engineers",
      "data engineer recruiting guide",
      "dbt Spark Airflow recruiter"
    ],
    "sections": [
      "Data role taxonomy",
      "Platform vs analytics engineering",
      "Stack signals",
      "Source lanes",
      "Boolean strings",
      "False positives",
      "Outreach angles"
    ],
    "workflow": [
      "Separate data engineer, analytics engineer, data platform engineer, BI engineer, ML/data infra, and ETL developer lanes.",
      "Use stack-specific signals: Spark, Airflow, dbt, Snowflake, Databricks, Kafka, Python, SQL, orchestration, ELT, data modeling, and cloud data platforms.",
      "Avoid confusing analysts with platform engineers unless transferable skills are intentional.",
      "Use GitHub/package/public projects where relevant, but do not overvalue side projects.",
      "Build donor-company lanes around modern data stack companies and cloud-heavy teams."
    ],
    "toolStack": [
      "Data Engineering mode",
      "BooleanOS",
      "X-Ray Launcher",
      "GitHub connector",
      "Project memory"
    ],
    "faq": [
      [
        "What is the biggest data sourcing issue?",
        "Title overlap between analysts, BI developers, ETL developers, and true platform engineers."
      ],
      [
        "What should you search first?",
        "Stack plus workflow terms, not just \u201cdata engineer.\u201d"
      ],
      [
        "Where does it convert?",
        "BooleanOS and Data Engineering mode."
      ]
    ],
    "ctaView": "boolean",
    "cta": "Generate data engineer strings"
  }
];


const contentWaves = [
  ['Week 1', 'Source Pack Methodology', 'GitHub X-Ray 25 Strings'],
  ['Week 2', 'Cybersecurity Boolean Library', 'How to Read a GitHub Profile'],
  ['Week 3', 'Cleared DevSecOps Playbook', 'Senior Sourcer ChatGPT Prompts'],
  ['Week 4', 'RN Sourcing Playbook', 'GovCon Company Map'],
  ['Month 2', 'LinkedIn Recruiter Alternatives', 'HM Intake Guide', 'Hugging Face Guide', 'Stack Overflow Guide', 'AI/ML Source Pack']
];
const doNotPublishYet = ['Generic best AI sourcing tools roundup', 'Generic Boolean cheat sheet', 'AI will transform recruiting think piece', 'Generic job description writing guide', '50 AI tools listicle with no workflow depth'];

const methodCards = [
  ['Cleared / GovCon', 'Start with clearance-safe language, donor companies, contract/program context, and manual verification. Never claim clearance is verified from public text.'],
  ['GitHub technical evidence', 'Search repos, READMEs, package ownership, commits, and profile bios for public evidence of hands-on work.'],
  ['Healthcare / nursing', 'Anchor on license, setting, acuity, specialty, EMR, location, shift pattern, and certification terms.'],
  ['AI / ML sourcing', 'Split LLM/RAG, MLOps, research, data infra, and product ML into different lanes to reduce noise.'],
  ['Rediscovery', 'Search ATS/CRM history before new sourcing. Re-rank prior candidates using current project memory.'],
  ['Contact-finding guardrails', 'Use contact tools only for compliant outreach. Keep opt-out, DNC, and source provenance visible.'],
  ['Aging req rescue', 'Diagnose bottlenecks from rejected slates, location, comp, clearance, title strictness, and source exhaustion.'],
  ['Hiring manager calibration', 'Translate strict market vs expanded market into tradeoff memos and calibration questions.'],
  ['Research / academic sourcing', 'Use OpenAlex, Semantic Scholar, ORCID, DBLP, arXiv, PubMed, and Crossref as evidence sources, not identity guarantees.'],
  ['Package ecosystem sourcing', 'Use npm, PyPI, Docker Hub, Hugging Face, GitHub, and maintainer metadata as public evidence with manual profile linking.']
];

const directoryRows = [
  ['LinkedIn Recruiter', 'Primary recruiter platform', 'Best for recruiter-native filtering, profile review, projects, and known professional profiles.'],
  ['Google X-Ray', 'Open web search', 'Best for public profiles, resumes, PDFs, company pages, and source-specific searches.'],
  ['GitHub', 'Technical evidence', 'Best for engineers with public repos, packages, topics, organizations, and project work.'],
  ['Stack Overflow / Stack Exchange', 'Technical evidence', 'Best for reputation, tags, public Q&A, and niche engineering signals.'],
  ['OpenAlex', 'Research evidence', 'Best for author metadata, concepts, institutions, and works count.'],
  ['Semantic Scholar', 'Research evidence', 'Best for author and paper evidence for research-heavy roles.'],
  ['ORCID', 'Research identity', 'Best for self-maintained researcher identity and works metadata.'],
  ['DBLP', 'Computer science research', 'Best for CS publications, conferences, and technical research identity.'],
  ['arXiv', 'AI/ML research', 'Best for preprint evidence in ML, AI, security, and research roles.'],
  ['PubMed', 'Healthcare research', 'Best for healthcare, clinical, biomedical, and life-science publication evidence.'],
  ['Crossref', 'Publication metadata', 'Best for DOI and citation metadata when identity must be confirmed elsewhere.'],
  ['Hugging Face', 'AI/ML evidence', 'Best for public models, datasets, spaces, and ML community artifacts.'],
  ['npm', 'JavaScript package evidence', 'Best for package ownership and JS/TS ecosystem signals.'],
  ['PyPI', 'Python package evidence', 'Best for Python, data, ML, infra, and backend package signals.'],
  ['Docker Hub', 'Container evidence', 'Best for public image and containerization evidence; manual-safe until API path is firm.'],
  ['NVD / CVE', 'Cyber context', 'Best for vulnerability context and cyber role intelligence; not a candidate database.'],
  ['CISA KEV', 'Cyber context', 'Best for known exploited vulnerability context and cyber role calibration.'],
  ['NPI Registry', 'Healthcare identity', 'Best for provider data where role relevance and privacy are carefully reviewed.'],
  ['ClinicalTrials.gov', 'Clinical research evidence', 'Best for trial investigators, organizations, and clinical research domains.'],
  ['NIH RePORTER', 'Research funding evidence', 'Best for grant/funding evidence with manual identity confirmation.'],
  ['hireEZ', 'AI sourcing platform', 'Open-web sourcing, rediscovery, enrichment, and campaign workflows.'],
  ['SeekOut', 'AI sourcing platform', 'Technical, cleared, expert, and open-web sourcing workflows.'],
  ['Juicebox', 'AI sourcing platform', 'Natural-language sourcing and modern agent-style UX.'],
  ['Gem', 'Recruiting CRM', 'Sequencing, CRM memory, pipeline analytics, and engagement history.'],
  ['Ashby', 'ATS / Recruiting OS', 'Structured pipeline, analytics, and clean recruiting workflows.'],
  ['Greenhouse', 'ATS', 'ATS rediscovery, candidate history, and structured hiring workflows.'],
  ['Lever', 'ATS / CRM', 'Pipeline management, CRM, and rediscovery workflows.'],
  ['Avature', 'Enterprise CRM / ATS', 'Enterprise talent CRM, campaigns, and rediscovery.'],
  ['Bullhorn', 'Staffing ATS / CRM', 'Agency recruiting database, client/candidate workflow, and redeployment.'],
  ['ContactOut', 'Contact finder', 'Candidate contact enrichment with provenance and opt-out caution.'],
  ['Apollo', 'Contact database', 'Company/contact enrichment with compliance-aware outreach workflows.'],
  ['Lusha', 'Contact finder', 'Contact lookup and enrichment; use with verification and policy guardrails.'],
  ['RocketReach', 'Contact finder', 'Email/contact discovery with source provenance and manual review.'],
  ['Hunter', 'Email finder', 'Domain/email pattern discovery and verification for approved outreach.'],
  ['ClearanceJobs', 'Cleared sourcing database', 'Manual authorized workflow for cleared candidates; no scraping.'],
  ['Dice', 'Technical job board/database', 'Tech resume database workflows and niche candidate discovery.']
];

const comparisons = [
  ['LinkedIn Recruiter', 'Best for recruiter-native filtering, projects, and known professional profiles.', 'Limited open-web evidence and expensive at scale.'],
  ['hireEZ', 'Strong open-web aggregation, rediscovery language, and outbound sourcing workflows.', 'Vendor data quality and coverage require validation.'],
  ['SeekOut', 'Strong technical, cleared, diversity, and expert sourcing positioning.', 'Can still need external workflow and recruiter judgment layer.'],
  ['Juicebox', 'Modern AI search UX and fast natural-language sourcing feel.', 'Needs careful verification and workflow memory around outputs.'],
  ['SourcingOS', 'Best positioned as the recruiter-controlled strategy, evidence, memory, and source-pack layer across tools.', 'Private beta; not a replacement for every data source yet.']
];

function tokenize(text: string) {
  const known = ['TS/SCI','Top Secret','Secret','Public Trust','AWS GovCloud','Azure Government','Kubernetes','Terraform','Docker','Python','Bash','Linux','CI/CD','FedRAMP','NIST','RMF','ATO','Security+','CISSP','React','TypeScript','Node','LLM','RAG','PyTorch','TensorFlow','MLOps','RN','BLS','ACLS','Epic','EMR','Snowflake','dbt','Airflow','Spark','SQL'];
  const lower = text.toLowerCase();
  return known.filter(k => lower.includes(k.toLowerCase().replace('+','')) || lower.includes(k.toLowerCase()));
}
function titleTokens(role: string) {
  const r = role.trim() || 'Software Engineer';
  const defaults = r.toLowerCase().includes('nurse') || r.toLowerCase().includes('rn') ? ['Registered Nurse','RN','Clinical Nurse'] : r.toLowerCase().includes('devsec') ? ['DevSecOps Engineer','Platform Engineer','Cloud Engineer','SRE'] : [r, 'Senior '+r, 'Lead '+r];
  return Array.from(new Set(defaults)).slice(0, 5);
}
function q(term: string) { return /\s|\//.test(term) ? `"${term}"` : term; }
function orTerms(items: string[]) { const clean = Array.from(new Set(items.filter(Boolean))).slice(0, 10).map(q); return clean.length > 1 ? `(${clean.join(' OR ')})` : clean[0] || ''; }
function googleUrl(query: string) { return `https://www.google.com/search?q=${encodeURIComponent(query)}`; }
function generatedStrings(role: string, jd: string) {
  const text = `${role}\n${jd}`;
  const lower = text.toLowerCase();
  const titles = titleTokens(role);
  const skills = tokenize(text);
  const exclusions = 'NOT (intern OR student OR "help desk" OR recruiter OR sales OR bootcamp OR trainer)';
  const titleGroup = orTerms(titles);
  if (/devsecops|govcloud|ts\/sci|fedramp|rmf|ato|dod|govcon|secret/.test(lower)) {
    const clearedTitles = orTerms(['DevSecOps Engineer','Platform Engineer','Cloud Engineer','Site Reliability Engineer','Infrastructure Engineer']);
    const cloudStack = orTerms(['AWS GovCloud','Terraform','Kubernetes','Docker','CI/CD','Linux','Python','Bash','Ansible','OpenShift']);
    const fedSignals = orTerms(['TS/SCI','Top Secret','Secret','DoD','FedRAMP','RMF','ATO','NIST','SCIF']);
    return { titles: ['DevSecOps Engineer','Platform Engineer','Cloud Engineer','SRE','Infrastructure Engineer'], skills: ['AWS GovCloud','Terraform','Kubernetes','Docker','CI/CD','Linux','RMF','ATO','FedRAMP','TS/SCI'], boolean: `${clearedTitles} AND ${cloudStack} AND ${fedSignals} AND ${exclusions}`, broad: `${orTerms(['Platform Engineer','Cloud Engineer','SRE','DevOps Engineer'])} AND ${orTerms(['Kubernetes','Terraform','AWS','Linux','CI/CD'])} AND ${orTerms(['DoD','federal','GovCloud','FedRAMP','RMF'])} AND ${exclusions}`, linkedin: `site:linkedin.com/in ${clearedTitles} ${cloudStack} ${fedSignals} -jobs -job -recruiter`, github: `site:github.com ${orTerms(['kubernetes','terraform','ansible','govcloud','openshift'])} ${orTerms(['devops','devsecops','platform','sre'])} -jobs -course -tutorial`, resume: `(filetype:pdf OR intitle:resume OR inurl:resume) ${clearedTitles} ${cloudStack} ${fedSignals}` };
  }
  if (/isso|issm|soc|rmf|cissp|security\+|appsec|penetration|threat|siem|cyber/.test(lower)) {
    const cyberTitles = orTerms(['ISSO','ISSM','Cybersecurity Engineer','Security Engineer','SOC Analyst','AppSec Engineer','RMF Analyst']);
    const cyberSignals = orTerms(['RMF','NIST','ATO','SIEM','Splunk','vulnerability','incident response','CISSP','Security+','cloud security']);
    return { titles: ['ISSO','ISSM','Security Engineer','SOC Analyst','RMF Analyst'], skills: ['RMF','NIST','ATO','SIEM','Splunk','CISSP','Security+','AppSec'], boolean: `${cyberTitles} AND ${cyberSignals} AND ${exclusions}`, broad: `${orTerms(['Security Engineer','Cyber Analyst','Information Security Analyst','SOC Analyst'])} AND ${orTerms(['SIEM','incident response','vulnerability','cloud security','NIST'])} AND ${exclusions}`, linkedin: `site:linkedin.com/in ${cyberTitles} ${cyberSignals} -jobs -job`, github: `site:github.com ${orTerms(['security','appsec','threat','detection','splunk','yara','sigma'])} -jobs -course`, resume: `(filetype:pdf OR intitle:resume OR inurl:resume) ${cyberTitles} ${cyberSignals}` };
  }
  if (/nurse|rn|clinical|icu|emr|epic|allied|healthcare/.test(lower)) {
    const nurseTitles = orTerms(['Registered Nurse','RN','Clinical Nurse','ICU Nurse','ER Nurse','Nurse Case Manager']);
    const nurseSignals = orTerms(['BLS','ACLS','BSN','Epic','EMR','acute care','patient assessment','ICU','ER','case management']);
    return { titles: ['Registered Nurse','RN','Clinical Nurse','ICU Nurse','ER Nurse'], skills: ['BLS','ACLS','BSN','Epic','EMR','acute care','patient assessment'], boolean: `${nurseTitles} AND ${nurseSignals} AND NOT (student OR instructor OR recruiter OR "home health aide")`, broad: `${orTerms(['RN','Registered Nurse','Clinical Nurse'])} AND ${orTerms(['hospital','acute care','Epic','BLS','ACLS'])}`, linkedin: `site:linkedin.com/in ${nurseTitles} ${nurseSignals} -jobs -job`, github: `site:linkedin.com/in ${nurseTitles} ${nurseSignals} -jobs -job`, resume: `(filetype:pdf OR intitle:resume OR inurl:resume) ${nurseTitles} ${nurseSignals}` };
  }
  if (/machine learning|ml engineer|ai engineer|llm|rag|pytorch|tensorflow|hugging face|vector/.test(lower)) {
    const aiTitles = orTerms(['Machine Learning Engineer','AI Engineer','Applied Scientist','MLOps Engineer','NLP Engineer','LLM Engineer']);
    const aiSignals = orTerms(['Python','PyTorch','TensorFlow','LLM','RAG','MLOps','embeddings','vector database','NLP']);
    return { titles: ['Machine Learning Engineer','AI Engineer','Applied Scientist','MLOps Engineer','NLP Engineer'], skills: ['Python','PyTorch','TensorFlow','LLM','RAG','MLOps','NLP','embeddings'], boolean: `${aiTitles} AND ${aiSignals} AND ${exclusions}`, broad: `${orTerms(['ML Engineer','AI Engineer','Data Scientist','Applied Scientist'])} AND ${orTerms(['Python','modeling','MLOps','NLP','LLM'])} AND ${exclusions}`, linkedin: `site:linkedin.com/in ${aiTitles} ${aiSignals} -jobs -job`, github: `site:github.com ${orTerms(['pytorch','tensorflow','transformers','llm','rag','mlops','embedding'])} -jobs -course`, resume: `(filetype:pdf OR intitle:resume OR inurl:resume) ${aiTitles} ${aiSignals}` };
  }
  const skillGroup = orTerms(skills.length ? skills : ['Python','AWS','Kubernetes','security']);
  const clearance = orTerms(skills.filter(s => /secret|sci|trust|security\+|cissp/i.test(s)));
  const boolean = [titleGroup, skillGroup, clearance, exclusions].filter(Boolean).join(' AND ');
  const broad = [titleGroup, orTerms([...(skills.slice(0, 4)), 'engineer', 'platform']), exclusions].filter(Boolean).join(' AND ');
  const linkedin = ['site:linkedin.com/in', titleGroup, skillGroup, clearance, '-jobs', '-job'].filter(Boolean).join(' ');
  const github = ['site:github.com', titleGroup, skillGroup, '-jobs'].filter(Boolean).join(' ');
  const resume = ['(intitle:resume OR inurl:resume OR filetype:pdf)', titleGroup, skillGroup].filter(Boolean).join(' ');
  return { titles, skills, boolean, broad, linkedin, github, resume };
}

function PublicTopBar({ view, setView }: { view: PublicView; setView: SetPublicView }) {
  return <nav className="public-nav inline-nav"><strong onClick={() => setView('vault')}>SourcingOS</strong><div><button className={view === 'vault' ? 'active' : ''} onClick={() => setView('vault')}>Vault Home</button><button onClick={() => setView('tools')}>Tools</button><button onClick={() => setView('methods')}>Methods</button><button onClick={() => setView('directory')}>Directory</button><button onClick={() => setView('blog')}>Blog</button><button onClick={() => setView('waitlist')}>Waitlist</button><button onClick={() => setView('beta')}>Private Beta</button></div></nav>;
}

function BetaCTA({ setView, label='Join the private beta' }: { setView: SetPublicView; label?: string }) {
  return <div className="cta-panel"><div><div className="eyebrow">Private beta bridge</div><h3>Use the public Vault to learn. Use SourcingOS Core to work.</h3><p>Save the full cockpit for invite-only users: Candidate 360, source connectors, AI synthesis, project memory, rediscovery, and recruiter-confirmed decisions.</p></div><div className="button-row"><button onClick={() => setView('waitlist')}>{label}</button><button className="secondary" onClick={() => setView('waitlist')}>Request beta access</button></div></div>;
}

function ToolsHub({ setView }: { setView: SetPublicView }) {
  return <main className="public-shell"><PublicTopBar view="tools" setView={setView} /><section className="tool-hero"><div><div className="eyebrow">Free tools hub</div><h1>Start with utility, then move into the private cockpit</h1><p>The public tools are intentionally useful without login: generate Boolean, launch X-Ray searches, and turn a messy JD into a search plan. Every tool routes into the private beta when the workflow needs Candidate 360, memory, and rediscovery.</p></div><button className="primary-alt" onClick={() => setView('waitlist')}>Join private beta</button></section><div className="vault-grid three">{vaultTools.slice(0,3).map(tool => <button type="button" className="vault-card clickable-card" key={tool.name} onClick={() => setView(tool.view)}><span>{tool.path}</span><h3>{tool.name}</h3><p>{tool.desc}</p><strong>{tool.cta} →</strong></button>)}</div><section className="vault-section split"><Card title="How the tools connect" eyebrow="Public → Beta"><List items={['BooleanOS creates the first search strings and source lanes.','X-Ray Launcher opens source-specific Google searches and tracks launches locally.','JD Strategy extracts target titles, evidence signals, and a first-pass sourcing plan.','SourcingOS Core turns the workflow into Candidate 360, synthesis, project memory, rediscovery, and pipeline decisions.']} /></Card><Card title="Best first workflow" eyebrow="Recommended path"><List items={['Paste the JD into JD Strategy.','Open BooleanOS with the must-have skills.','Launch X-Ray for LinkedIn, GitHub, and PDF resumes.','Join beta to save projects, compare candidates, and record feedback memory.']} /></Card></section></main>;
}

function BooleanTool({ setView }: { setView: SetPublicView }) {
  const [role, setRole] = useState('Senior DevSecOps Engineer');
  const [jd, setJd] = useState('Active TS/SCI required. AWS GovCloud, Terraform, Kubernetes, Docker, CI/CD, Linux, Python or Bash, RMF, ATO, NIST, FedRAMP, DoD experience.');
  const strings = generatedStrings(role, jd);
  return <main className="public-shell"><PublicTopBar view="boolean" setView={setView} /><section className="tool-hero"><div><div className="eyebrow">Free tool / BooleanOS</div><h1>Boolean generator + X-Ray launchpad</h1><p>Paste a role, generate recruiter-ready Boolean strings, copy them, or launch public X-Ray searches in Google. This is the public utility layer that feeds the private SourcingOS beta.</p></div><button className="primary-alt" onClick={() => setView('waitlist')}>Unlock advanced version in beta</button></section><div className="grid split"><Card title="Role input" eyebrow="Generate search strings"><div className="sample-row"><button className="secondary" onClick={() => { setRole('Senior DevSecOps Engineer'); setJd('Active TS/SCI required. AWS GovCloud, Terraform, Kubernetes, Docker, CI/CD, Linux, Python or Bash, RMF, ATO, NIST, FedRAMP, DoD experience.'); }}>Cleared DevSecOps</button><button className="secondary" onClick={() => { setRole('ISSO / RMF Analyst'); setJd('RMF, NIST 800-53, ATO, eMASS, Security+, CISSP, vulnerability management, DoD environment, Secret or TS clearance preferred.'); }}>Cyber / RMF</button><button className="secondary" onClick={() => { setRole('Registered Nurse'); setJd('RN license, BLS, ACLS, acute care, Epic EMR, ICU or ER experience, Minneapolis / St. Paul area.'); }}>RN</button><button className="secondary" onClick={() => { setRole('Machine Learning Engineer'); setJd('LLM applications, RAG, vector databases, Python, PyTorch, MLOps, embeddings, model evaluation, production ML systems.'); }}>AI / ML</button></div><label>Role title</label><input value={role} onChange={e => setRole(e.target.value)} /><label>JD / notes / must-haves</label><textarea rows={12} value={jd} onChange={e => setJd(e.target.value)} /><div className="tag-cloud"><Pill tone="blue">Titles: {strings.titles.length}</Pill><Pill tone="good">Signals: {strings.skills.length}</Pill><Pill tone="warn">Human review required</Pill></div></Card><Card title="Generated BooleanOS output" eyebrow="Copy or launch"><h3>LinkedIn / ATS Boolean</h3><CodeBox label="Balanced Boolean" text={strings.boolean} /><CodeBox label="Broad Boolean" text={strings.broad} /><h3>Public X-Ray searches</h3><CodeBox label="LinkedIn X-Ray" text={strings.linkedin} /><CodeBox label="GitHub X-Ray" text={strings.github} /><CodeBox label="Resume/PDF X-Ray" text={strings.resume} /><div className="button-row"><button onClick={() => { trackEvent('tool_launch','boolean_linkedin_xray'); window.open(googleUrl(strings.linkedin), '_blank'); }}>Open LinkedIn X-Ray</button><button className="secondary" onClick={() => { trackEvent('tool_launch','boolean_github_xray'); window.open(googleUrl(strings.github), '_blank'); }}>Open GitHub X-Ray</button><button className="secondary" onClick={() => { trackEvent('tool_launch','boolean_resume_xray'); window.open(googleUrl(strings.resume), '_blank'); }}>Open Resume X-Ray</button></div></Card></div><BetaCTA setView={setView} /></main>;
}

function XrayTool({ setView }: { setView: SetPublicView }) {
  const [query, setQuery] = useState('"DevSecOps Engineer" "AWS GovCloud" Kubernetes Terraform "TS/SCI"');
  const platforms = [
    ['LinkedIn profiles', `site:linkedin.com/in ${query} -jobs -job`],
    ['GitHub', `site:github.com ${query}`],
    ['PDF resumes', `(filetype:pdf OR intitle:resume OR inurl:resume) ${query}`],
    ['Company pages', `(site:leidos.com OR site:gdit.com OR site:caci.com OR site:boozallen.com) ${query}`]
  ];
  return <main className="public-shell"><PublicTopBar view="xray" setView={setView} /><section className="tool-hero"><div><div className="eyebrow">Free tool / X-Ray Launcher</div><h1>Run source-specific Google X-Ray searches</h1><p>Build launchable searches for LinkedIn public profiles, GitHub, PDFs, and target-company pages.</p></div></section><div className="grid split"><Card title="Search concept" eyebrow="What are you trying to find?"><textarea rows={8} value={query} onChange={e => setQuery(e.target.value)} /><div className="guardrail">Use public search responsibly. Do not scrape restricted sites or infer protected traits.</div></Card><Card title="Launchable lanes" eyebrow="Click to open Google">{platforms.map(([label, q]) => <div key={label} className="xray-row"><CodeBox label={label} text={q} /><button onClick={() => { trackEvent('tool_launch', label); window.open(googleUrl(q), '_blank'); }}>Open</button></div>)}</Card></div></main>;
}

function JDStrategyTool({ setView }: { setView: SetPublicView }) {
  const [role, setRole] = useState('AI/ML Engineer');
  const [jd, setJd] = useState('LLM applications, RAG, vector databases, Python, PyTorch, MLOps, model evaluation, embeddings, production ML systems. Remote preferred.');
  const strings = generatedStrings(role, jd);
  return <main className="public-shell"><PublicTopBar view="jd" setView={setView} /><section className="tool-hero"><div><div className="eyebrow">Free tool / JD Strategy</div><h1>Turn a messy req into a search plan</h1><p>Extract titles, signals, risk notes, and first sourcing lanes before you start searching.</p></div><button className="primary-alt" onClick={() => setView('beta')}>Open full Core V15.9 analysis</button></section><div className="grid split"><Card title="JD input" eyebrow="Role intelligence"><input value={role} onChange={e => setRole(e.target.value)} /><textarea rows={12} value={jd} onChange={e => setJd(e.target.value)} /></Card><Card title="Search strategy preview" eyebrow="Public lightweight version"><h3>Target titles</h3><div className="tag-cloud">{strings.titles.map(t => <Pill key={t} tone="blue">{t}</Pill>)}</div><h3>Evidence signals</h3><div className="tag-cloud">{strings.skills.map(s => <Pill key={s}>{s}</Pill>)}</div><h3>Recommended first move</h3><List items={['Run balanced Boolean first in LinkedIn Recruiter or ATS.', 'If results are thin, loosen title variants before loosening must-have skills.', 'Use X-Ray as an evidence lane, not a replacement for recruiter review.', 'Move into private SourcingOS Core for Candidate 360, synthesis, memory, and rediscovery.']} /><CodeBox label="First-pass Boolean" text={strings.boolean} /></Card></div></main>;
}

function MethodsPage({ setView }: { setView: SetPublicView }) {
  return <main className="public-shell"><PublicTopBar view="methods" setView={setView} /><section className="tool-hero"><div><div className="eyebrow">Sourcing methods vault</div><h1>Practical sourcing methods by role, source, and constraint</h1><p>This is the public library layer. These cards are structured so they can become full SEO articles and source-pack templates.</p></div><button onClick={() => setView('playbooks')}>Open playbooks</button></section><div className="vault-grid three">{methodCards.map(([title, desc]) => <article className="vault-card clickable-card" key={title}><span>Method</span><h3>{title}</h3><p>{desc}</p><button onClick={() => setView(title.includes('Cleared') || title.includes('Aging') ? 'jd' : 'boolean')}>Build a search plan</button></article>)}</div><BetaCTA setView={setView} /></main>;
}

function DirectoryPage({ setView }: { setView: SetPublicView }) {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const categories = ['All', ...Array.from(new Set(directoryRows.map(([, cat]) => cat)))];
  const rows = directoryRows.filter(([tool, cat, use]) => (filter === 'All' || cat === filter) && `${tool} ${cat} ${use}`.toLowerCase().includes(search.toLowerCase()));
  return <main className="public-shell"><PublicTopBar view="directory" setView={setView} /><section className="tool-hero"><div><div className="eyebrow">Recruiting tool directory</div><h1>Source and recruiting tools mapped by workflow</h1><p>Filter contact finders, AI sourcing platforms, public evidence sources, ATS/CRM rediscovery tools, job boards, and compliance-sensitive resources by recruiter use case.</p></div><button onClick={() => setView('comparisons')}>Compare tools</button></section><Card title="Directory filters" eyebrow="Find the right stack"><div className="button-row wrap"><select value={filter} onChange={e => setFilter(e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tools, categories, or use cases" /><button className="secondary" onClick={() => { setFilter('All'); setSearch(''); }}>Reset</button></div><div className="guardrail">Directory notes are workflow guidance, not paid rankings. Sponsored placements should be labeled when added later.</div></Card><div className="table directory-table"><div className="tr head"><div>Tool</div><div>Category</div><div>Best use</div></div>{rows.map(([tool, cat, use]) => <div className="tr" key={tool}><div><strong>{tool}</strong></div><div>{cat}</div><div>{use}</div></div>)}</div><BetaCTA setView={setView} label="Request directory beta access" /></main>;
}

function BlogPage({ setView, setArticle }: { setView: SetPublicView; setArticle: (slug: string) => void }) {
  return <main className="public-shell"><PublicTopBar view="blog" setView={setView} /><section className="tool-hero"><div><div className="eyebrow">SEO / GEO content engine</div><h1>High-intent article map</h1><p>Each guide connects directly into a free tool, source pack, Boolean generator, or private beta CTA.</p></div><button onClick={() => setView('waitlist')}>Join publishing beta</button></section><div className="article-grid">{articleGuides.map((guide, idx) => <article className="article-card clickable-card" key={guide.slug}><small>{guide.category} {idx+1}</small><h3>{guide.title}</h3><p>{guide.summary}</p><div className="tag-cloud compact-tags">{guide.keywords.slice(0,3).map(k => <Pill key={k}>{k}</Pill>)}</div><button onClick={() => { setArticle(guide.slug); setView('article'); }}>Read guide</button></article>)}</div><section className="vault-section split"><Card title="Publishing sequence" eyebrow="Claude + team synthesis"><div className="timeline">{contentWaves.map(([week, a, b]) => <div key={week}><strong>{week}</strong><span>{a} · {b}</span></div>)}</div></Card><Card title="Do not publish yet" eyebrow="Avoid commodity SEO"><List items={doNotPublishYet} /></Card></section></main>;
}

function ArticlePage({ slug, setView }: { slug: string; setView: SetPublicView }) {
  const guide = articleGuides.find(g => g.slug === slug) || articleGuides[0];
  const strings = generatedStrings(guide.title.replace(/^How to source /,'').replace(/^Best /,''), guide.keywords.join(' '));
  return <main className="public-shell"><PublicTopBar view="article" setView={setView} /><article className="content-page"><div className="eyebrow">{guide.category} / SourcingOS Guide</div><h1>{guide.title}</h1><p className="lead">{guide.summary}</p><div className="tag-cloud">{guide.keywords.map(k => <Pill key={k} tone="blue">{k}</Pill>)}</div><div className="content-grid"><section><h2>Direct answer</h2><p>{guide.intent} The practical answer is to split the search into source lanes, keep evidence separate from inference, and use recruiter-confirmed decisions before saving, merging, contacting, or submitting anyone.</p><h2>Recommended structure</h2><List items={guide.sections} /><h2>Workflow</h2><List items={guide.workflow} /><h2>Starter search strings</h2><CodeBox label="Balanced Boolean" text={strings.boolean} /><CodeBox label="Broad Boolean" text={strings.broad} /><CodeBox label="Google X-Ray" text={strings.linkedin} /><CodeBox label="GitHub / evidence X-Ray" text={strings.github} /><h2>Tool stack</h2><div className="tag-cloud">{guide.toolStack.map(t => <Pill key={t}>{t}</Pill>)}</div><h2>Compliance and quality guardrails</h2><p>Use public information as sourcing evidence, not as a final hiring decision. Do not infer protected traits, do not scrape restricted sites, do not auto-send outreach, do not auto-merge on name alone, and do not claim verified clearance or licensure from public breadcrumbs.</p><h2>FAQ</h2>{guide.faq.map(([q,a]) => <div className="faq-item" key={q}><h3>{q}</h3><p>{a}</p></div>)}</section><aside><Card title="Recommended next action" eyebrow="One clear CTA"><p>Use the related free tool first. Join the beta only when you need saved projects, Candidate 360, memory, and rediscovery.</p><button onClick={() => setView(guide.ctaView)}>{guide.cta}</button></Card><Card title="Related public pages" eyebrow="Internal linking"><button onClick={() => setView('methods')}>Methods Library</button><button className="secondary" onClick={() => setView('directory')}>Tool Directory</button><button className="secondary" onClick={() => setView('comparisons')}>Comparison Engine</button><button className="secondary" onClick={() => setView('playbooks')}>Source Packs</button></Card><Card title="Beta preview" eyebrow="Private cockpit"><p className="muted">The full cockpit adds Evidence Matrix, profile linking, HM pitch, project memory, and rediscovery.</p><button className="secondary" onClick={() => setView('waitlist')}>Request private beta</button></Card></aside></div></article></main>;
}

function ComparisonsPage({ setView }: { setView: SetPublicView }) {
  return <main className="public-shell"><PublicTopBar view="comparisons" setView={setView} /><section className="tool-hero"><div><div className="eyebrow">Comparison engine</div><h1>Recruiting tool comparisons that lead into workflows</h1><p>Use comparison pages for high-intent searches, but keep the angle practical: what tool is best for which source lane, evidence type, and recruiter workflow?</p></div></section><div className="table comparison-table"><div className="tr head"><div>Platform</div><div>Where it wins</div><div>Limitations / notes</div></div>{comparisons.map(([tool, win, limit]) => <div className="tr" key={tool}><div><strong>{tool}</strong></div><div>{win}</div><div>{limit}</div></div>)}</div><BetaCTA setView={setView} /></main>;
}

function PlaybooksPage({ setView }: { setView: SetPublicView }) {
  return <main className="public-shell"><PublicTopBar view="playbooks" setView={setView} /><section className="tool-hero"><div><div className="eyebrow">Role-specific source packs</div><h1>Public playbooks that can become private SourcingOS projects</h1><p>Each playbook should define strict market, expanded market, donor companies, source lanes, false positives, verification steps, and a 7-day execution plan.</p></div></section><div className="vault-grid three">{['Cleared DevSecOps Source Pack','Cybersecurity RMF / ISSO Source Pack','AI/ML Platform Engineer Source Pack','Registered Nurse Source Pack','Healthcare IT / FHIR Source Pack','Data Engineer Federal Source Pack'].map((title, idx) => <article className="vault-card" key={title}><span>Source Pack {idx+1}</span><h3>{title}</h3><List items={['Direct titles + adjacent titles','Must-have evidence signals','Best sources and tool stack','False positives to avoid','CTA into SourcingOS Core project']} /><button onClick={() => setView('jd')}>Generate search plan</button></article>)}</div></main>;
}

function WaitlistPage({ setView }: { setView: SetPublicView }) {
  const [email, setEmail] = useState('');
  const [segment, setSegment] = useState('Technical recruiter');
  const [status, setStatus] = useState('');
  function submit() { const item = { email, segment, time: new Date().toISOString(), source: 'SourcingOS V16 waitlist' }; const prior = JSON.parse(localStorage.getItem('sourcingos.waitlist') || '[]'); localStorage.setItem('sourcingos.waitlist', JSON.stringify([...prior, item])); trackEvent('waitlist_submit', segment); setStatus('Saved in this local preview. Production launch still needs ConvertKit, Beehiiv, Resend, Supabase, or a Vercel form endpoint.'); }
  return <main className="public-shell"><PublicTopBar view="waitlist" setView={setView} /><section className="tool-hero"><div><div className="eyebrow">Private beta waitlist</div><h1>Join the first private beta cohort</h1><p>Get early access to the sourcing cockpit, beta releases, and the first Source Pack templates. The full app stays invite-only while we tune Candidate 360, Evidence Matrix, project memory, and rediscovery.</p></div></section><div className="grid split"><Card title="Join the beta list" eyebrow="Local placeholder form"><label>Email</label><input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /><label>Recruiting focus</label><select value={segment} onChange={e => setSegment(e.target.value)}>{['Technical recruiter','Cleared / GovCon recruiter','Healthcare recruiter','Agency recruiter','Corporate TA','Founder / operator','Recruiting leader'].map(x => <option key={x}>{x}</option>)}</select><div className="button-row"><button onClick={submit}>Save waitlist request</button><button className="secondary" onClick={() => { const data = localStorage.getItem('sourcingos.waitlist') || '[]'; const blob = new Blob([data], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'sourcingos-waitlist-preview.json'; a.click(); URL.revokeObjectURL(url); }}>Export preview list</button></div>{status && <div className="guardrail goodish">{status}</div>}</Card><Card title="What beta users get" eyebrow="Gated product"><List items={['Candidate 360 dossiers','Source profile linking with no auto-merge','10-source technical/research connector pack','Facts vs inference synthesis','Project memory and rediscovery re-ranking','Recruiter-controlled outreach and pipeline decisions']} /><button className="secondary" onClick={() => setView('beta')}>Preview private cockpit</button></Card></div></main>;
}


function AnalyticsPage({ setView }: { setView: SetPublicView }) {
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  useEffect(() => { setEvents(JSON.parse(localStorage.getItem('sourcingos.analytics') || '[]')); }, []);
  const counts = events.reduce<Record<string, number>>((acc, e) => { acc[e.label] = (acc[e.label] || 0) + 1; return acc; }, {});
  return <main className="public-shell"><PublicTopBar view="analytics" setView={setView} /><section className="tool-hero"><div><div className="eyebrow">V16 launch instrumentation</div><h1>Local analytics + capture dashboard</h1><p>Before adding paid plans or heavy auth, use this local panel to confirm which public pages, free tools, and CTAs get attention. Production should connect this to Plausible, PostHog, Vercel Analytics, Supabase, ConvertKit, or Beehiiv.</p></div><button onClick={() => { localStorage.removeItem('sourcingos.analytics'); setEvents([]); }}>Clear local events</button></section><div className="grid split"><Card title="Event totals" eyebrow="Local only"><div className="table analytics-table"><div className="tr head"><div>Label</div><div>Events</div><div>Purpose</div></div>{Object.entries(counts).length ? Object.entries(counts).map(([label, count]) => <div className="tr" key={label}><div><strong>{label}</strong></div><div>{count}</div><div>Use this to prioritize V16.1 tools, articles, and directory categories.</div></div>) : <div className="tr"><div>No events yet</div><div>0</div><div>Click around the Vault or submit the waitlist form.</div></div>}</div></Card><Card title="Recent events" eyebrow="Last 25"><div className="timeline">{events.slice(-25).reverse().map((e, idx) => <div key={`${e.time}-${idx}`}><strong>{e.type}: {e.label}</strong><span>{e.path} · {new Date(e.time).toLocaleString()}</span></div>)}</div></Card></div></main>;
}

function PublicVault({ setView, setArticle }: { setView: SetPublicView; setArticle: (slug: string) => void }) {
  return <main className="public-shell">
    <header className="vault-hero">
      <nav className="public-nav">
        <strong>SourcingOS</strong>
        <div>
          <button onClick={() => setView('tools')}>Tools</button>
          <button onClick={() => setView('methods')}>Methods</button>
          <button onClick={() => setView('directory')}>Directory</button>
          <button onClick={() => setView('blog')}>Blog</button>
          <button onClick={() => setView('waitlist')}>Waitlist</button>
          <button onClick={() => setView('beta')}>Private Beta</button>
        </div>
      </nav>
      <div className="vault-hero-grid">
        <section>
          <div className="eyebrow">SourcingOS Vault + private core</div>
          <h1>Find who your search missed.</h1>
          <p>SourcingOS helps senior sourcers map hard-to-fill roles, generate better search lanes, compare tools, and move from public sourcing methods into an invite-only evidence cockpit.</p>
          <div className="hero-actions">
            <button className="primary-link" onClick={() => setView('tools')}>Explore free tools</button>
            <button className="secondary" onClick={() => setView('waitlist')}>Join beta waitlist</button>
          </div>
        </section>
        <aside className="beta-panel">
          <div className="eyebrow">Private beta layer</div>
          <h2>Private beta: Evidence Matrix cockpit</h2>
          <List items={['Candidate 360 dossiers','10-source connector registry','Facts vs inference synthesis','Project memory and feedback events','Rediscovery re-ranking','Local-first recruiter judgment loop']} />
          <button className="primary-alt" onClick={() => setView('waitlist')}>Request beta access</button>
        </aside>
      </div>
    </header>

    <section id="tools" className="vault-section">
      <div className="section-title"><div><div className="eyebrow">Connected free tools</div><h2>Public acquisition layer</h2></div><span>SEO + utility + waitlist</span></div>
      <div className="vault-grid three">{vaultTools.map(tool => <button type="button" className="vault-card clickable-card" key={tool.name} onClick={() => setView(tool.view)}><span>{tool.path}</span><h3>{tool.name}</h3><p>{tool.desc}</p><strong>{tool.cta} →</strong></button>)}</div>
    </section>

    <section id="methods" className="vault-section split">
      <Card title="Sourcing Methods Vault" eyebrow="Public content engine"><List items={['Cleared / GovCon sourcing playbooks','Technical sourcing methods by source','Contact finder workflows and guardrails','Boolean and X-Ray libraries by role','Healthcare, cyber, AI/ML, data, and federal source packs']} /><button onClick={() => setView('methods')}>Open methods library</button></Card>
      <Card title="Design system match" eyebrow="Unified brand"><p className="muted">The Vault and Core share the same SourcingOS visual language: navy/slate base, electric blue highlights, cyan signals, white cards, rounded cockpit panels, and status badges for risk, evidence, source health, and beta access.</p><div className="tag-cloud"><Pill tone="blue">public vault</Pill><Pill tone="good">free tools</Pill><Pill tone="warn">beta gated</Pill><Pill>local-first</Pill></div></Card>
    </section>

    <section id="blog" className="vault-section">
      <div className="section-title"><div><div className="eyebrow">SEO / GEO article engine</div><h2>Starter high-intent content map</h2></div><span>{articleGuides.length} launch targets</span></div>
      <div className="article-grid">{articleGuides.map((guide, idx) => <button type="button" className="article-card clickable-card" key={guide.slug} onClick={() => { setArticle(guide.slug); setView('article'); }}><small>{guide.category} {idx+1}</small><h3>{guide.title}</h3><p>{guide.summary}</p></button>)}</div>
    </section>
  </main>;
}


function BetaGate({ setView }: { setView: SetPublicView }) {
  const [pass, setPass] = useState('');
  const [ok, setOk] = useState(() => typeof window !== 'undefined' && localStorage.getItem('sourcingos.betaAccess') === 'true');
  if (ok) return <div><div className="beta-return"><button onClick={() => setView('vault')}>← Back to SourcingOS Vault</button><span>Private beta preview. Keep this route gated before public launch.</span></div><CoreCockpit /></div>;
  return <main className="public-shell"><PublicTopBar view="beta" setView={setView} /><section className="tool-hero"><div><div className="eyebrow">Private beta gate</div><h1>SourcingOS Core is invite-only</h1><p>The public Vault is open. The full cockpit stays protected until waitlist, analytics, and beta feedback loops are ready.</p></div><button onClick={() => setView('waitlist')}>Request access</button></section><Card title="Enter preview passphrase" eyebrow="Local demo gate"><p className="muted">For local testing only, use <code>sourcingos-beta</code>. Replace this with real auth or invite tokens before launch.</p><input value={pass} onChange={e => setPass(e.target.value)} placeholder="Preview passphrase" /><div className="button-row"><button onClick={() => { if (pass.trim() === 'sourcingos-beta') { localStorage.setItem('sourcingos.betaAccess','true'); setOk(true); } }}>Unlock preview</button><button className="secondary" onClick={() => setView('vault')}>Back to Vault</button></div></Card></main>;
}

export default function App() {
  const [view, setRawView] = useState<PublicView>(() => viewFromLocation());
  const [articleSlug, setArticleSlug] = useState(() => {
    if (typeof window === 'undefined') return articleGuides[0].slug;
    const part = window.location.pathname.split('/blog/')[1]?.replace(/\/$/, '');
    return part || articleGuides[0].slug;
  });
  const setView: SetPublicView = (next) => {
    setRawView(next);
    const path = analyticsPath(next, articleSlug);
    if (typeof window !== 'undefined' && window.location.pathname !== path) window.history.pushState({ view: next }, '', path);
    trackEvent('page_view', next);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  useEffect(() => {
    trackEvent('page_view', view);
    const onPop = () => setRawView(viewFromLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    const m = metaFor(view, articleSlug);
    document.title = m.title;
    upsertMeta('description', m.description);
    upsertCanonical(m.path);
  }, [view, articleSlug]);
  const chooseArticle = (slug: string) => { setArticleSlug(slug); setRawView('article'); const path = `/blog/${slug}`; if (typeof window !== 'undefined') window.history.pushState({ view: 'article', slug }, '', path); trackEvent('article_open', slug); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  if (view === 'tools') return <ToolsHub setView={setView} />;
  if (view === 'beta') return <BetaGate setView={setView} />;
  if (view === 'boolean') return <BooleanTool setView={setView} />;
  if (view === 'xray') return <XrayTool setView={setView} />;
  if (view === 'jd') return <JDStrategyTool setView={setView} />;
  if (view === 'methods') return <MethodsPage setView={setView} />;
  if (view === 'directory') return <DirectoryPage setView={setView} />;
  if (view === 'blog') return <BlogPage setView={setView} setArticle={chooseArticle} />;
  if (view === 'article') return <ArticlePage slug={articleSlug} setView={setView} />;
  if (view === 'comparisons') return <ComparisonsPage setView={setView} />;
  if (view === 'playbooks') return <PlaybooksPage setView={setView} />;
  if (view === 'waitlist') return <WaitlistPage setView={setView} />;
  if (view === 'analytics') return <AnalyticsPage setView={setView} />;
  return <PublicVault setView={setView} setArticle={chooseArticle} />;
}
