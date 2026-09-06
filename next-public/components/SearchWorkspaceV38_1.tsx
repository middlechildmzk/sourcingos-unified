'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { CandidateRow, type CandidateRowPerson } from '@/components/CandidateRow'
import { SearchHealthV38, type SearchHealthSessionV38 } from '@/components/SearchHealthV38'
import { buildSlateCopilotAnswerV38_1 } from '@/lib/slate-copilot-v38-1'
import { reviewShortcutBlockedByModifierV41 } from '@/lib/review/session-v41'
import {
  assessObservationRequirementV41,
  buildObservationRequirementsV41,
  canonicalContactV41,
  slateCompanyContextV41,
  tallyObservationEvidenceV41,
  type ObservationRequirementState,
} from '@/lib/search/observation-evidence-v41'
import {
  mobileSearchPaneV41,
  resolveSearchWorkspacePhaseV41,
  searchColumnTemplateV41,
  searchWorkspaceLayoutV41,
  type SearchWorkspaceBreakpoint,
} from '@/lib/search/workspace-layout-v41'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'
import type { FitDecision, RoleStage } from '@/lib/role-workspace'
import styles from './SearchWorkspaceV38_1.module.css'

type Requirement = { text: string; mustHave: boolean }
type ProviderRequest = { query: string; requirements?: Requirement[]; names?: string[]; titles?: string[]; skills?: string[]; companies?: string[]; locations?: string[]; limit: number; highFreshness: boolean }
type ToolPlan = { tool: string; rationale: string; costClass: string; freshnessClass: string; approvalRequired: boolean; executableNow: boolean; targetCount?: number }
type PeoplePlan = { action: 'search_people' | 'approval_required'; assistantSummary: string; providerRequest: ProviderRequest; criteria: { titles: string[]; skills: string[]; companies: string[]; locations: string[]; requirements: Requirement[]; limit: number }; toolPlan: ToolPlan[]; assumptions: string[]; warnings: string[]; model: { configured: boolean; used: boolean; provider?: string; model?: string } }
type WebPlan = { action: 'search_web'; assistantSummary: string; webRequest: { action: 'search_web'; query: string }; toolPlan: ToolPlan[]; assumptions: string[]; warnings: string[]; model: { configured: boolean; used: boolean; provider?: string; model?: string } }
type AgentPlan = PeoplePlan | WebPlan

type Experience = { title?: string; company?: string; location?: string; startDate?: string; endDate?: string; current?: boolean; description?: string }
type Education = { school?: string; degree?: string; field?: string; startDate?: string; endDate?: string; description?: string }
type Certification = { name: string; issuer?: string; issuedAt?: string; expiresAt?: string; credentialUrl?: string }
type Project = { name: string; description?: string; url?: string; technologies?: string[] }
type RichProfile = { summary?: string; experience?: Experience[]; education?: Education[]; certifications?: Certification[]; projects?: Project[] }
type Observation = CandidateRowPerson & { observedAt?: string; refreshedAt?: string; sourceUrl?: string; richProfile?: RichProfile; providerExplanation?: string; providerRetrievalScore?: number; providerScoreScale?: string }
type SignedReviewObservation = { observation: Observation; observationSignature: string }
type Telemetry = { provider: string; status: string; discovered: number; latencyMs: number; message?: string }
type AutoCaptureResult = { enabled: boolean; attempted: number; persisted: number; created: number; reused: number; failed: number; identityResolutionDeferred: boolean; contactValuesCaptured: boolean }
type SearchResult = { observations: Observation[]; reviewObservations: SignedReviewObservation[]; telemetry: Telemetry[]; discoveredBeforeCap: number; returnedAfterCap: number; contributingProviders: number; relevanceRejected?: number; warnings: string[]; searchHealth?: SearchHealthSessionV38; autoCapture?: AutoCaptureResult }
type ProviderStatus = { id: string; label: string; configured: boolean; executableNow: boolean; capabilities: string[]; transports: string[]; costClass: string; freshness: string }
type WebResearch = { provider: string; transport?: string; tool?: string; text: string; observedAt?: string; freshness?: string }
type ContactSignal = { type: string; channelKind?: string; value: string; sourceProvider?: string; deliverability?: string; permissionStatus?: string }
type ContactOutcome = { signals: ContactSignal[]; message: string; error?: string }
type ChatMessage = { id: string; role: 'user' | 'assistant'; kind: 'search' | 'slate' | 'action'; text: string }
type SavedState = { candidateId: string; candidateUrl?: string }

type SearchStreamEvent =
  | { type: 'start'; providers: string[] }
  | { type: 'provider'; telemetry: Telemetry }
  | { type: 'final'; payload: Record<string, unknown> }
  | { type: 'error'; error: string }

function label(value: string) { return value.split('_').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ') }
function contactLabel(value: boolean | 'unknown' | undefined) { return value === true ? 'Available' : value === false ? 'Not returned' : 'Not checked' }
function statusClass(status: string) { const value = status.toLowerCase(); return ['completed', 'success', 'ready'].includes(value) ? 'is-complete' : ['failed', 'error'].includes(value) ? 'is-failed' : ['unavailable', 'disabled', 'skipped'].includes(value) ? 'is-skipped' : 'is-pending' }
function keyFor(person: Observation) { return `${person.provider}:${person.providerPersonId}` }
function why(person: Observation, plan?: PeoplePlan) { const skills = new Set((plan?.criteria.skills || []).map(value => value.toLowerCase())); const matches = (person.skills || []).filter(skill => skills.has(skill.toLowerCase())).slice(0, 3); if (matches.length) return `Observed ${matches.join(', ')} in ${label(person.provider)} evidence.`; if (plan?.criteria.titles.some(title => (person.currentTitle || person.headline || '').toLowerCase().includes(title.toLowerCase()))) return `Observed title aligns with ${plan.criteria.titles[0]}.`; return `Retrieved by ${label(person.provider)} for this search; review evidence before judging fit.` }
// Stated requirements only. Counting discovery-expansion terms would inflate an
// evidence signal using the search's own retrieval instructions.
function evidenceCount(person: Observation, plan?: PeoplePlan) {
  if (!plan) return 0
  const assessments = buildObservationRequirementsV41(plan).map(item => assessObservationRequirementV41(person, item))
  return tallyObservationEvidenceV41(assessments).supported
}
function identityPayload(person: Observation) { const linkedinUrl = person.profileUrls?.find(item => item.kind === 'linkedin')?.url; return { providerName: person.provider, providerPersonId: person.providerPersonId, fullName: person.displayName, title: person.currentTitle || person.headline, currentCompany: person.currentEmployer, location: person.location, profileUrl: linkedinUrl || person.profileUrls?.[0]?.url, linkedinUrl, sourceContext: 'search_workspace_v38_1' } }
function rolePrompt(role: ReturnType<typeof useRoleWorkspaces>['roles'][number]) { return [role.intake.title, role.intake.location !== 'Not specified' ? `in or near ${role.intake.location}` : '', role.intake.clearance !== 'Not specified' ? `${role.intake.clearance} clearance` : '', role.intake.mustHaves.length ? `must have ${role.intake.mustHaves.join(', ')}` : '', role.intake.niceToHaves.length ? `prioritize ${role.intake.niceToHaves.join(', ')}` : ''].filter(Boolean).join(' · ') }
function normalizeSearchResult(payload: Record<string, unknown>): SearchResult {
  const quality = payload.searchQuality && typeof payload.searchQuality === 'object' ? (payload.searchQuality as { v38?: SearchHealthSessionV38 }).v38 : undefined
  const capture = payload.autoCapture && typeof payload.autoCapture === 'object' ? payload.autoCapture as Partial<AutoCaptureResult> : undefined
  return {
    observations: Array.isArray(payload.observations) ? payload.observations as Observation[] : [],
    reviewObservations: Array.isArray(payload.reviewObservations) ? payload.reviewObservations as SignedReviewObservation[] : [],
    autoCapture: capture ? { enabled: Boolean(capture.enabled), attempted: Number(capture.attempted || 0), persisted: Number(capture.persisted || 0), created: Number(capture.created || 0), reused: Number(capture.reused || 0), failed: Number(capture.failed || 0), identityResolutionDeferred: capture.identityResolutionDeferred !== false, contactValuesCaptured: Boolean(capture.contactValuesCaptured) } : undefined,
    telemetry: Array.isArray(payload.telemetry) ? payload.telemetry as Telemetry[] : [],
    discoveredBeforeCap: Number(payload.discoveredBeforeCap || 0),
    returnedAfterCap: Number(payload.returnedAfterCap || 0),
    contributingProviders: Number(payload.contributingProviders || 0),
    relevanceRejected: Number(payload.relevanceRejected || 0),
    warnings: Array.isArray(payload.warnings) ? payload.warnings as string[] : [],
    searchHealth: quality,
  }
}
function csvCell(value: unknown) { const text = value == null ? '' : String(value); return `"${text.replaceAll('"', '""')}"` }
function downloadText(name: string, contents: string, type: string) { const blob = new Blob([contents], { type }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
function safeFileName(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'candidate' }
function channelLabel(channel: string) { return channel === 'work_email' ? 'Work email' : channel === 'personal_email' ? 'Personal email' : channel === 'phone' ? 'Mobile / phone' : 'Profile' }
function confidenceLabel(value: string) { return value === 'verified' ? 'Verified' : value === 'likely' ? 'Likely' : value === 'possible' ? 'Possible' : 'Not checked' }
function stateMark(state: ObservationRequirementState) { return state === 'supported' ? '●' : state === 'contradicted' ? '▲' : state === 'needs_verification' ? '○' : '–' }
function stateLabel(state: ObservationRequirementState) { return state === 'supported' ? 'Evidenced' : state === 'contradicted' ? 'Contradicted' : state === 'needs_verification' ? 'Needs verification' : 'No evidence found' }
function dateRange(item: { startDate?: string; endDate?: string; current?: boolean }) { return [item.startDate || '', item.current ? 'Present' : item.endDate || ''].filter(Boolean).join(' – ') || 'Dates not returned' }

export function SearchWorkspaceV38_1({ initialQuery = '', roleId, source }: { initialQuery?: string; roleId?: string; source?: string }) {
  const { roles, updateRole } = useRoleWorkspaces()
  const role = roleId ? roles.find(item => item.id === roleId) : undefined
  const [searchDraft, setSearchDraft] = useState(initialQuery)
  const [lastSearchQuery, setLastSearchQuery] = useState(initialQuery)
  const [chatDraft, setChatDraft] = useState('')
  const [composerMode, setComposerMode] = useState<'search' | 'ask'>('search')
  const [plan, setPlan] = useState<AgentPlan | null>(null)
  const [previousPlan, setPreviousPlan] = useState<PeoplePlan | undefined>()
  const [result, setResult] = useState<SearchResult | null>(null)
  const [web, setWeb] = useState<WebResearch | null>(null)
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [working, setWorking] = useState<'planning' | 'searching' | 'web' | 'contacts' | 'saving' | ''>('')
  const [error, setError] = useState('')
  const [liveTelemetry, setLiveTelemetry] = useState<Telemetry[]>([])
  const [contactPendingKey, setContactPendingKey] = useState<string | null>(null)
  const [contactByKey, setContactByKey] = useState<Record<string, ContactOutcome>>({})
  const [savedByKey, setSavedByKey] = useState<Record<string, SavedState>>({})
  const [bulkStatus, setBulkStatus] = useState('')
  const [railCollapsed, setRailCollapsed] = useState(false)
  const [breakpoint, setBreakpoint] = useState<SearchWorkspaceBreakpoint>('wide')
  const [mobileBriefOpen, setMobileBriefOpen] = useState(false)
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const prefilledRole = useRef(false)
  const searchRef = useRef<HTMLTextAreaElement>(null)
  const chatRef = useRef<HTMLTextAreaElement>(null)

  const peoplePlan = plan?.action === 'search_people' || plan?.action === 'approval_required' ? plan as PeoplePlan : undefined
  const observations = result?.observations || []
  const capture = result?.autoCapture
  const selected = selectedIndex === null ? null : observations[selectedIndex] || null

  // Layout is derived from what the agent is doing and what the recruiter has
  // open. See lib/search/workspace-layout-v41.ts for the rules and tests.
  const phase = resolveSearchWorkspacePhaseV41({ working, hasResult: Boolean(result), hasWeb: Boolean(web) })
  const layout = searchWorkspaceLayoutV41({ phase, railCollapsed, hasSelection: Boolean(selected), breakpoint })
  const mobilePane = mobileSearchPaneV41({ phase, hasSelection: Boolean(selected), briefOpen: mobileBriefOpen })
  const gridTemplate = searchColumnTemplateV41(layout.columns)

  // matchMedia rather than a resize handler: the effect body only subscribes,
  // and the initial read is deferred so it never sets state synchronously
  // during the effect. Server render stays at the 'wide' default.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mobile = window.matchMedia('(max-width: 760px)')
    const narrow = window.matchMedia('(max-width: 1240px)')
    const resolve = () => setBreakpoint(mobile.matches ? 'mobile' : narrow.matches ? 'narrow' : 'wide')
    const frame = window.requestAnimationFrame(resolve)
    mobile.addEventListener('change', resolve)
    narrow.addEventListener('change', resolve)
    return () => {
      window.cancelAnimationFrame(frame)
      mobile.removeEventListener('change', resolve)
      narrow.removeEventListener('change', resolve)
    }
  }, [])

  const must = peoplePlan?.criteria.requirements.filter(item => item.mustHave) || []
  const preferences = peoplePlan?.criteria.requirements.filter(item => !item.mustHave) || []

  useEffect(() => { if (!initialQuery && role && !prefilledRole.current) { const prompt = rolePrompt(role); setSearchDraft(prompt); setLastSearchQuery(prompt); prefilledRole.current = true } }, [initialQuery, role])
  useEffect(() => { let alive = true; fetch('/api/agentic-sourcing/providers', { headers: { accept: 'application/json' }, cache: 'no-store' }).then(async response => { const json = await response.json().catch(() => ({})); if (alive && response.ok && json.ok && Array.isArray(json.providers)) setProviders(json.providers) }).catch(() => undefined); return () => { alive = false } }, [])
  useEffect(() => { const onKey = (event: KeyboardEvent) => { const target = event.target as HTMLElement | null; if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return; if (target?.isContentEditable) return; if (reviewShortcutBlockedByModifierV41(event)) return; if (!observations.length) return; if (event.key.toLowerCase() === 'j') { event.preventDefault(); setSelectedIndex(current => Math.min(observations.length - 1, current === null ? 0 : current + 1)) } if (event.key.toLowerCase() === 'k') { event.preventDefault(); setSelectedIndex(current => Math.max(0, current === null ? 0 : current - 1)) } if (event.key === 'Escape') setSelectedIndex(null) }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [observations.length])

  const sourceTelemetry = useMemo(() => {
    if (result?.telemetry?.length) return result.telemetry
    if (liveTelemetry.length) return liveTelemetry
    if (!working || ['contacts', 'saving'].includes(working)) return []
    const capability = working === 'web' ? 'search_web' : 'search_people'
    return providers.filter(provider => provider.configured && provider.executableNow && provider.capabilities.includes(capability)).slice(0, 12).map(provider => ({ provider: provider.id, status: 'eligible', discovered: 0, latencyMs: 0, message: 'Eligible source; awaiting execution telemetry.' }))
  }, [providers, result, liveTelemetry, working])

  function applyProviderProgress(telemetry: Telemetry) { setLiveTelemetry(current => { const index = current.findIndex(item => item.provider === telemetry.provider); if (index < 0) return [...current, telemetry]; const next = [...current]; next[index] = telemetry; return next }) }
  function addChat(roleValue: ChatMessage['role'], kind: ChatMessage['kind'], text: string) { setChat(current => [...current, { id: crypto.randomUUID(), role: roleValue, kind, text }].slice(-24)) }

  async function runSearch(event?: FormEvent, override?: string) {
    event?.preventDefault()
    const message = (override ?? searchDraft).trim()
    if (!message || working) return
    setError(''); setWeb(null); setLiveTelemetry([]); setWorking('planning'); setLastSearchQuery(message); addChat('user', 'search', message)
    try {
      const response = await fetch('/api/agent-runtime/plan', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ message, ...(previousPlan ? { previousPlan } : {}) }) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.ok || !json.plan) throw new Error(json.error || 'SourcingOS could not interpret this search.')
      const next = json.plan as AgentPlan
      setPlan(next); addChat('assistant', 'search', next.assistantSummary)
      if (next.action === 'search_web') {
        setWorking('web')
        const webResponse = await fetch('/api/agentic-sourcing/web', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(next.webRequest) })
        const webJson = await webResponse.json().catch(() => ({}))
        if (!webResponse.ok || !webJson.ok || !webJson.result) throw new Error(webJson.error || 'Live web research failed.')
        setWeb(webJson.result as WebResearch); return
      }
      if (next.action === 'approval_required') { addChat('assistant', 'action', 'That request needs an explicit recruiter approval. Use the candidate-level action in Candidate 360 so the current slate is preserved.'); return }
      setPreviousPlan(next); setWorking('searching'); setResult(null); setSelectedIndex(null)
      const searchResponse = await fetch('/api/candidate-data/search?stream=1', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/x-ndjson, application/json' }, body: JSON.stringify(next.providerRequest) })
      if (!searchResponse.ok) { const failure = await searchResponse.json().catch(() => ({})); throw new Error(failure.error || 'People search failed.') }
      let finalPayload: Record<string, unknown> | null = null
      const contentType = searchResponse.headers.get('content-type') || ''
      if (searchResponse.body && contentType.includes('application/x-ndjson')) {
        const reader = searchResponse.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
        while (true) {
          const { done, value } = await reader.read(); buffer += decoder.decode(value || new Uint8Array(), { stream: !done }); const lines = buffer.split('\n'); buffer = lines.pop() || ''
          for (const line of lines) { if (!line.trim()) continue; const streamEvent = JSON.parse(line) as SearchStreamEvent; if (streamEvent.type === 'start') setLiveTelemetry(streamEvent.providers.map(provider => ({ provider, status: 'running', discovered: 0, latencyMs: 0, message: 'Provider request is running.' }))); else if (streamEvent.type === 'provider') applyProviderProgress(streamEvent.telemetry); else if (streamEvent.type === 'error') throw new Error(streamEvent.error || 'People search failed.'); else if (streamEvent.type === 'final') finalPayload = streamEvent.payload }
          if (done) break
        }
        if (buffer.trim()) { const streamEvent = JSON.parse(buffer) as SearchStreamEvent; if (streamEvent.type === 'provider') applyProviderProgress(streamEvent.telemetry); if (streamEvent.type === 'error') throw new Error(streamEvent.error || 'People search failed.'); if (streamEvent.type === 'final') finalPayload = streamEvent.payload }
      } else finalPayload = await searchResponse.json().catch(() => null) as Record<string, unknown> | null
      if (!finalPayload || finalPayload.ok !== true) throw new Error(String(finalPayload?.error || 'People search ended without a final retained slate.'))
      const nextResult = normalizeSearchResult(finalPayload); setLiveTelemetry(nextResult.telemetry); setResult(nextResult); if (nextResult.observations.length) setSelectedIndex(0); setComposerMode('ask'); const captureNote = nextResult.autoCapture?.enabled ? ` I also captured ${nextResult.autoCapture.persisted} source observation${nextResult.autoCapture.persisted === 1 ? '' : 's'} into durable SourcingOS memory (${nextResult.autoCapture.created} new, ${nextResult.autoCapture.reused} refreshed${nextResult.autoCapture.failed ? `, ${nextResult.autoCapture.failed} capture failed` : ''}).` : ''; addChat('assistant', 'search', `I retained ${nextResult.observations.length} candidate${nextResult.observations.length === 1 ? '' : 's'} from ${nextResult.discoveredBeforeCap || nextResult.observations.length} discoveries.${captureNote} I am now in review mode—ask about this slate without rerunning providers.`)
    } catch (caught) { const messageText = caught instanceof Error ? caught.message : 'Search failed.'; setError(messageText); addChat('assistant', 'action', messageText) } finally { setWorking('') }
  }

  function askSlate(event?: FormEvent, override?: string) {
    event?.preventDefault(); const message = (override ?? chatDraft).trim(); if (!message || working) return
    addChat('user', 'slate', message)
    const answer = buildSlateCopilotAnswerV38_1({ input: message, selectedIndex, candidates: observations.map(person => ({ ...person, why: why(person, peoplePlan), supportedEvidence: evidenceCount(person, peoplePlan) })) })
    addChat('assistant', 'slate', answer); setChatDraft('')
  }

  function signedFor(person: Observation) { return result?.reviewObservations.find(item => item.observation.provider === person.provider && item.observation.providerPersonId === person.providerPersonId) }
  function attachToRole(person: Observation, candidateId: string, fitDecision: FitDecision = 'unreviewed', stage: RoleStage = 'needs_review') {
    if (!roleId) return
    updateRole(roleId, workspace => {
      const now = new Date().toISOString(); const existing = workspace.candidates.find(item => item.candidateId === candidateId || item.id === keyFor(person))
      const nextCandidate = { id: existing?.id || keyFor(person), candidateId, name: person.displayName, headline: person.currentTitle || person.headline || '', company: person.currentEmployer || '', location: person.location || '', source: person.provider, sourceUrl: person.profileUrls?.[0]?.url, stage, fitDecision, fitReasons: fitDecision === 'strong_fit' ? [why(person, peoplePlan)] : existing?.fitReasons || [], concerns: fitDecision === 'not_fit' ? ['Recruiter marked not fit; add a specific reason during calibration review.'] : existing?.concerns || [], tags: existing?.tags || [], contactStatus: contactByKey[keyFor(person)]?.signals.length ? 'signals_found' as const : existing?.contactStatus || 'unknown' as const, evidenceStatus: existing?.evidenceStatus || 'unreviewed' as const, addedAt: existing?.addedAt || now, updatedAt: now }
      return { ...workspace, candidates: existing ? workspace.candidates.map(item => item.id === existing.id ? nextCandidate : item) : [nextCandidate, ...workspace.candidates], activity: [{ id: crypto.randomUUID(), type: existing ? 'candidate_reviewed' as const : 'candidate_added' as const, message: `${person.displayName} ${existing ? 'reviewed' : 'saved'} from People Search.`, createdAt: now }, ...workspace.activity], updatedAt: now }
    })
  }

  async function savePerson(person: Observation): Promise<SavedState | null> {
    const key = keyFor(person); if (savedByKey[key]) return savedByKey[key]
    const signed = signedFor(person)
    if (!signed) { setError('This observation was not server-signed for saving. The search result remains reviewable, but SourcingOS will not trust a client-reconstructed candidate.'); return null }
    setWorking('saving'); setError('')
    try {
      const response = await fetch('/api/candidate-data/save', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ observation: signed.observation, observationSignature: signed.observationSignature }) })
      const json = await response.json().catch(() => ({})); if (!response.ok || !json.ok || !json.candidateId) throw new Error(json.error || 'Candidate save failed.')
      const state = { candidateId: String(json.candidateId), candidateUrl: typeof json.candidateUrl === 'string' ? json.candidateUrl : undefined }; setSavedByKey(current => ({ ...current, [key]: state })); attachToRole(person, state.candidateId); addChat('assistant', 'action', `${person.displayName} was saved${role ? ` to ${role.intake.title}` : ' to the Candidate Graph'}. No identity merge or hiring decision was performed.`); return state
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Candidate save failed.'); return null } finally { setWorking('') }
  }

  async function reviewPerson(person: Observation, fitDecision: FitDecision) {
    const saved = await savePerson(person); if (!saved) return
    const stage: RoleStage = fitDecision === 'strong_fit' ? 'shortlisted' : fitDecision === 'not_fit' ? 'archived' : 'needs_review'; attachToRole(person, saved.candidateId, fitDecision, stage); addChat('assistant', 'action', `${person.displayName} is now marked ${fitDecision.replaceAll('_', ' ')} for this role. This is your recruiter decision; SourcingOS did not infer it.`)
  }

  async function saveAll() {
    if (!observations.length || working) return; setBulkStatus(`Saving 0/${observations.length}…`)
    let saved = 0
    for (const person of observations) { const outcome = await savePerson(person); if (outcome) saved += 1; setBulkStatus(`Saving ${saved}/${observations.length}…`) }
    setBulkStatus(`${saved}/${observations.length} saved`); addChat('assistant', 'action', `${saved} retained candidate${saved === 1 ? '' : 's'} were saved. Observations that could not be server-verified were left unsaved rather than reconstructed in the browser.`)
  }

  async function approveSelectedContact(person: Observation) {
    const key = keyFor(person); setWorking('contacts'); setError('')
    try {
      const response = await fetch('/api/contact-enrichment/find', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ purpose: 'contact_bundle', ...identityPayload(person) }) })
      const json = await response.json().catch(() => ({})); const outcome: ContactOutcome = { signals: Array.isArray(json.signals) ? json.signals : [], message: String(json.message || json.error || 'Contact lookup completed.'), ...(!response.ok || !json.ok ? { error: String(json.error || 'Contact lookup failed.') } : {}) }; setContactByKey(current => ({ ...current, [key]: outcome })); setContactPendingKey(null); addChat('assistant', 'action', outcome.signals.length ? `Contact enrichment returned ${outcome.signals.length} signal${outcome.signals.length === 1 ? '' : 's'} for ${person.displayName}. Review provenance and permission state before use.` : `${person.displayName}: ${outcome.error || outcome.message}`)
    } catch (caught) { const message = caught instanceof Error ? caught.message : 'Contact lookup failed.'; setContactByKey(current => ({ ...current, [key]: { signals: [], message, error: message } })); setError(message) } finally { setWorking('') }
  }

  function exportCsv() {
    const header = ['rank','name','title','employer','location','provider','supported_requirement_signals','email_state','phone_state','linkedin','github','stackoverflow','website']
    const rows = observations.map((person, index) => { const urls = Object.fromEntries((person.profileUrls || []).map(item => [item.kind, item.url])); return [index + 1, person.displayName, person.currentTitle || person.headline || '', person.currentEmployer || '', person.location || '', person.provider, evidenceCount(person, peoplePlan), contactLabel(person.contactAvailability?.email), contactLabel(person.contactAvailability?.phone), urls.linkedin || '', urls.github || '', urls.stackoverflow || '', urls.personal || ''] })
    downloadText(`sourcingos-${safeFileName(role?.intake.title || lastSearchQuery || 'search')}-candidates.csv`, [header, ...rows].map(row => row.map(csvCell).join(',')).join('\n'), 'text/csv;charset=utf-8')
  }

  function exportBrief(person: Observation) {
    const profile = person.richProfile; const briefAssessments = buildObservationRequirementsV41(peoplePlan).map(item => assessObservationRequirementV41(person, item)); const statedBrief = briefAssessments.filter(item => item.origin !== 'discovery_expansion'); const expansionBrief = briefAssessments.filter(item => item.origin === 'discovery_expansion'); const lines = [`# ${person.displayName}`, '', [person.currentTitle || person.headline, person.currentEmployer].filter(Boolean).join(' · '), person.location || 'Location not evidenced', '', '## SourcingOS review context', why(person, peoplePlan), '', '## Requirement evidence', ...statedBrief.map(item => `- ${stateLabel(item.state).toUpperCase()} — ${item.requirement} (${item.origin === 'must_have' ? 'must have' : 'preferred'})${item.quotedEvidence.length ? `\n  > ${item.quotedEvidence[0]}` : ''}\n  Why: ${item.rationale}`), '', '## Discovery expansion (search logic, not candidate evidence)', expansionBrief.length ? expansionBrief.map(item => item.requirement).join(', ') : 'None applied.', '', '## External profiles', ...((person.profileUrls || []).map(item => `- ${label(item.kind)}: ${item.url}`)), '', '## Professional summary', profile?.summary || 'No provider-observed summary returned.', '', '## Experience', ...((profile?.experience || []).flatMap(item => [`### ${item.title || 'Role'}${item.company ? ` — ${item.company}` : ''}`, dateRange(item), item.location || '', item.description || '', ''])), '', '## Education', ...((profile?.education || []).map(item => `- ${[item.degree, item.field, item.school].filter(Boolean).join(' · ') || 'Education record'} (${dateRange(item)})`)), '', '## Skills', (person.skills || []).join(', ') || 'No structured skills returned.', '', '---', 'Generated by SourcingOS from provider-observed evidence. This is a SourcingOS candidate brief, not the candidate’s original resume. Missing fields remain unknown and no qualification decision is implied.']
    downloadText(`${safeFileName(person.displayName)}-sourcingos-candidate-brief.md`, lines.join('\n'), 'text/markdown;charset=utf-8')
  }

  return <div
    className="search-workspace"
    data-phase={layout.phase}
    data-rail={layout.rail}
    data-mobile-pane={mobilePane}
    data-detail={layout.detailVisible ? 'open' : 'closed'}
    style={{ ['--sos-search-columns' as string]: gridTemplate }}
  >
    <section className="search-workspace-left" data-collapsed={layout.rail === 'collapsed'}>
      <button type="button" className="search-rail-toggle" onClick={() => setRailCollapsed(value => !value)} aria-expanded={layout.rail === 'expanded'} aria-label={layout.rail === 'expanded' ? 'Collapse search brief rail' : 'Expand search brief rail'}>{layout.rail === 'expanded' ? '«' : '»'}</button>
      <header className="search-pane-head"><div><span className="search-kicker">AI sourcing copilot</span><h1>{result ? 'Search + review' : 'Who are you looking for?'}</h1></div><button type="button" className="search-icon-button" onClick={() => { setPlan(null); setPreviousPlan(undefined); setResult(null); setWeb(null); setSelectedIndex(null); setLiveTelemetry([]); setChat([]); setChatDraft(''); setComposerMode('search'); const prompt = role ? rolePrompt(role) : ''; setSearchDraft(prompt); setLastSearchQuery(prompt) }} aria-label="New search">＋</button></header>
      {role && <div className="search-role-context"><span><b>{role.intake.title}</b><small>Role-linked search · recruiter decisions stay attached to this role.</small></span><Link href={`/app/roles/${encodeURIComponent(role.id)}`}>Back to role</Link></div>}
      {!role && source && source !== 'direct' && <div className="search-route-context">Consolidated from {label(source.replaceAll('-', '_'))}. One Search Brain owns people discovery.</div>}
      {result && lastSearchQuery && <div className={styles.originalQuery}><small>Current search · preserved</small><p>{lastSearchQuery}</p></div>}
      <div className={styles.modeTabs}><button type="button" data-active={composerMode === 'search'} onClick={() => { setComposerMode('search'); requestAnimationFrame(() => searchRef.current?.focus()) }}>Search / refine</button><button type="button" data-active={composerMode === 'ask'} disabled={!result} onClick={() => { setComposerMode('ask'); requestAnimationFrame(() => chatRef.current?.focus()) }}>Ask about results</button></div>
      {composerMode === 'search' ? <form className="search-composer" onSubmit={runSearch}><textarea ref={searchRef} value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder="Find a RHEL admin with 5+ years near Annapolis Junction, MD with Secret clearance or higher…" rows={4} disabled={Boolean(working)} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') void runSearch() }} /><div className="search-composer-footer"><span>Runs providers · ⌘↵</span><button type="submit" disabled={!searchDraft.trim() || Boolean(working)}>{working && working !== 'contacts' && working !== 'saving' ? 'Working…' : result ? 'Refine search' : 'Search'}</button></div></form> : <form className="search-composer" onSubmit={askSlate}><textarea ref={chatRef} value={chatDraft} onChange={event => setChatDraft(event.target.value)} placeholder="Ask: Why are these the top 3? Which candidates show stronger RHEL evidence? What is missing for this person?" rows={4} disabled={!result || Boolean(working)} /><div className="search-composer-footer"><span>Uses current slate · no provider rerun</span><button type="submit" disabled={!chatDraft.trim() || !result || Boolean(working)}>Ask</button></div></form>}
      {result && <div className={styles.quickActions}><button onClick={() => askSlate(undefined, 'Why did you select the top 3?')} type="button">Why top 3?</button><button onClick={() => askSlate(undefined, 'What can I do next with these results?')} type="button">What next?</button><button onClick={() => askSlate(undefined, 'How do I find contact info for the selected candidate?')} type="button">Contact help</button></div>}
      {plan && <section className="search-brief"><div className="search-section-title"><span>Interpretation</span><small>{plan.model.used ? `${label(plan.model.provider || 'AI')} planner` : 'deterministic planner'}</small></div><p className="search-plan-summary">{plan.assistantSummary}</p>{peoplePlan && <div className="search-brief-groups">{!!peoplePlan.criteria.titles.length && <div><small>Role</small><div>{peoplePlan.criteria.titles.map(item => <span key={item}>{item}</span>)}</div></div>}{!!peoplePlan.criteria.locations.length && <div><small>Location</small><div>{peoplePlan.criteria.locations.map(item => <span key={item}>{item}</span>)}</div></div>}{!!must.length && <div><small>Must have</small><div>{must.map(item => <span className="is-must" key={item.text}>{item.text}</span>)}</div></div>}{!!preferences.length && <div><small>Prioritize</small><div>{preferences.map(item => <span key={item.text}>{item.text.replace(/^Preference:\s*/i, '')}</span>)}</div></div>}{!!peoplePlan.criteria.skills.length && <div><small>Discovery expansion</small><div>{peoplePlan.criteria.skills.slice(0, 10).map(item => <span key={item}>{item}</span>)}</div></div>}</div>}</section>}
      <section className="search-history"><div className="search-section-title"><span>Conversation</span><small>{chat.length ? `${chat.length} messages` : 'session'}</small></div>{!chat.length ? <p className="search-empty-copy">Tell the copilot who you need. The agent interprets the brief, runs eligible sources, captures retained discoveries into SourcingOS memory, and then keeps the returned slate in context for follow-up questions.</p> : <div className={styles.chatList}>{chat.map(message => <div key={message.id} className={styles.chatMessage} data-role={message.role}><small>{message.role === 'user' ? 'You' : 'SourcingOS'} · {message.kind}</small>{message.text}</div>)}</div>}</section>
    </section>

    <main className="search-workspace-center">
      <header className="search-results-head"><div><span className="search-kicker">Candidate slate</span><h2>{working === 'searching' ? 'AI sourcing in progress…' : result ? `${observations.length} retained candidates` : web ? 'Live web research' : 'Your results will appear here'}</h2></div><div className="search-results-meta"><button type="button" className="search-mobile-brief-toggle" onClick={() => setMobileBriefOpen(value => !value)} aria-expanded={mobileBriefOpen}>{mobileBriefOpen ? 'Hide brief' : 'Search brief'}</button>{result && <><span>{result.discoveredBeforeCap || observations.length} discovered</span><span>{result.contributingProviders || 0} sources</span>{capture?.enabled && <span>{capture.persisted} captured</span>}{Boolean(result.relevanceRejected) && <span>{result.relevanceRejected} relevance filtered</span>}</>}{!!observations.length && <span>J/K review</span>}</div></header>
      <section className="provider-progress" data-mode={layout.agentActivity} aria-label="AI sourcing agent activity">
        <div className="search-section-title"><span>Agent activity</span><small>{working && !['contacts','saving'].includes(working) ? 'live run' : result ? 'run complete' : 'ready'}</small>{layout.agentActivity === 'strip' && <button type="button" onClick={() => setDiagnosticsOpen(value => !value)} aria-expanded={diagnosticsOpen}>{diagnosticsOpen ? 'Hide source detail' : 'Source detail'}</button>}</div>
        {(layout.agentActivity === 'prominent' || diagnosticsOpen) && <div className={styles.agentPipeline}>
          <div data-state={working === 'planning' ? 'active' : plan ? 'done' : 'idle'}><i>1</i><span><b>Understand brief</b><small>{plan ? 'Requirements and discovery expansion separated.' : 'Waiting for recruiter intent.'}</small></span></div>
          <div data-state={working === 'searching' ? 'active' : result ? 'done' : 'idle'}><i>2</i><span><b>Orchestrate sources</b><small>{working === 'searching' ? 'Searching configured people sources now.' : result ? `${result.contributingProviders || 0} source${result.contributingProviders === 1 ? '' : 's'} contributed.` : 'Provider execution begins after planning.'}</small></span></div>
          <div data-state={capture?.enabled ? (capture.failed ? 'warning' : 'done') : working === 'searching' ? 'queued' : 'idle'}><i>3</i><span><b>Capture memory</b><small>{capture?.enabled ? `${capture.persisted} persisted · ${capture.created} new · ${capture.reused} refreshed${capture.failed ? ` · ${capture.failed} failed` : ''}` : working === 'searching' ? 'Queued behind source normalization.' : 'Retained discoveries become durable memory.'}</small></span></div>
          <div data-state={result ? 'done' : 'idle'}><i>4</i><span><b>Review ready</b><small>{result ? `${observations.length} candidates retained for human review.` : 'Evidence stays uncertain until reviewed.'}</small></span></div>
        </div>}
        {layout.agentActivity === 'strip' && !diagnosticsOpen && <div className="provider-progress-summary">
          <span>Brief understood</span><i>›</i><span>{result?.contributingProviders || 0} source{(result?.contributingProviders || 0) === 1 ? '' : 's'} searched</span><i>›</i><span>{result?.discoveredBeforeCap || observations.length} discovered</span><i>›</i>{capture?.enabled ? <><span>{capture.persisted} captured</span><i>›</i></> : null}<b>{observations.length} ready for review</b>
        </div>}
        {working && !['contacts','saving'].includes(working) && <div className="provider-progress-bar"><span /></div>}
        {(layout.agentActivity === 'prominent' || diagnosticsOpen) && <div className="provider-progress-list">{sourceTelemetry.length ? sourceTelemetry.map(item => <div className={`provider-progress-item ${statusClass(item.status)}`} key={item.provider} title={item.message || ''}><i /><span>{label(item.provider)}</span><b>{item.status === 'eligible' ? 'eligible' : item.status}</b>{item.discovered > 0 && <small>{item.discovered}</small>}</div>) : <span className="search-empty-copy">Executed source telemetry appears here as the agent works. Eligible is not the same as executed.</span>}</div>}
      </section>
      {result?.searchHealth && <SearchHealthV38 quality={result.searchHealth} />}
      {result && <div className={styles.nextSteps}><div><strong>{capture?.enabled ? 'Discoveries captured. Review the slate.' : 'Results are ready. What next?'}</strong><span>{capture?.enabled ? 'SourcingOS memory is already updated. Review evidence → add strong people to the role → find contact only when needed → refine or export.' : 'Review a candidate → inspect evidence/profile history → find contact if needed → save/disposition → refine or export.'}</span></div><div className={styles.bulkActions}>{role && <button type="button" onClick={() => void saveAll()} disabled={Boolean(working)}>{bulkStatus || 'Add all to role'}</button>}<button type="button" onClick={exportCsv}>Export CSV</button></div></div>}
      {working === 'searching' && <div className="candidate-skeleton-list">{Array.from({ length: 6 }).map((_, index) => <div className="candidate-skeleton" key={index}><i /><span /><span /><b /></div>)}</div>}
      {!working && !result && !web && <div className="search-zero-state"><div className="search-zero-mark">✦</div><h3>Give the sourcing agent a hiring brief.</h3><p>Describe the role naturally. SourcingOS will interpret the requirements, orchestrate available sources, capture durable discoveries, and return an evidence-first slate you can refine conversationally.</p><div><button type="button" onClick={() => setSearchDraft('Find 25 backend engineers in Minneapolis, MN with AWS + Kubernetes')}>Backend engineers · Minneapolis</button><button type="button" onClick={() => setSearchDraft('Find a RHEL admin near Annapolis Junction, MD with Secret clearance or higher')}>RHEL · Secret+ · Maryland</button></div></div>}
      {error && <div className="search-error">{error}</div>}
      {result && <div className="candidate-slate">{observations.map((person, index) => <CandidateRow key={keyFor(person)} person={person} rank={index + 1} selected={selectedIndex === index} why={why(person, peoplePlan)} evidenceCount={evidenceCount(person, peoplePlan)} onSelect={() => { setSelectedIndex(index); setMobileBriefOpen(false) }} />)}{!observations.length && <div className="search-zero-state compact"><h3>No candidates cleared this search.</h3><p>Refine the brief rather than treating missing evidence as rejection. Provider failures and zero-result sources remain visible above.</p></div>}</div>}
      {web && <div className="search-web-result"><div><span className="search-kicker">{label(web.provider)} · {web.transport || 'live'}</span><h3>Fresh external research</h3></div><pre>{web.text}</pre><p>External web material is untrusted evidence input. It is not automatically candidate truth, identity verification, qualification, or permission to contact.</p></div>}
    </main>

    <aside className={`search-workspace-right ${selected ? 'has-selection' : ''}`} data-mobile-pane={mobilePane}>
      {selected && <button type="button" className="search-mobile-back" onClick={() => setSelectedIndex(null)}>‹ Back to results</button>}{!selected ? <div className="inspector-empty"><span className="search-kicker">Candidate 360</span><div className="inspector-avatar">◎</div><h3>Select a candidate</h3><p>Open a row to review experience, external profiles, requirement evidence, contact state, provenance, and recruiter actions.</p></div> : <CandidateInspectorV38_1 person={selected} plan={peoplePlan} slate={observations} rank={(selectedIndex || 0) + 1} total={observations.length} saved={savedByKey[keyFor(selected)]} contact={contactByKey[keyFor(selected)]} contactPending={contactPendingKey === keyFor(selected)} working={working} onClose={() => setSelectedIndex(null)} onPrev={() => setSelectedIndex(current => Math.max(0, (current || 0) - 1))} onNext={() => setSelectedIndex(current => Math.min(observations.length - 1, (current || 0) + 1))} onSave={() => void savePerson(selected)} onContact={() => setContactPendingKey(keyFor(selected))} onCancelContact={() => setContactPendingKey(null)} onApproveContact={() => void approveSelectedContact(selected)} onReview={decision => void reviewPerson(selected, decision)} onExport={() => exportBrief(selected)} />}</aside>
  </div>
}

function CandidateInspectorV38_1({ person, plan, slate, rank, total, saved, contact, contactPending, working, onClose, onPrev, onNext, onSave, onContact, onCancelContact, onApproveContact, onReview, onExport }: { person: Observation; plan?: PeoplePlan; slate: Observation[]; rank: number; total: number; saved?: SavedState; contact?: ContactOutcome; contactPending: boolean; working: string; onClose: () => void; onPrev: () => void; onNext: () => void; onSave: () => void; onContact: () => void; onCancelContact: () => void; onApproveContact: () => void; onReview: (decision: FitDecision) => void; onExport: () => void }) {
  const assessments = buildObservationRequirementsV41(plan).map(item => assessObservationRequirementV41(person, item))
  const statedAssessments = assessments.filter(item => item.origin !== 'discovery_expansion')
  const expansionTerms = assessments.filter(item => item.origin === 'discovery_expansion')
  const tally = tallyObservationEvidenceV41(assessments)
  const contacts = canonicalContactV41(contact?.signals || [])
  const companyContext = slateCompanyContextV41(person.currentEmployer, slate)
  const links = person.profileUrls || []; const profile = person.richProfile; const canAct = !working
  return <div className="candidate-inspector"><header className="candidate-inspector-nav"><span>{rank} of {total}</span><div><button type="button" onClick={onPrev} disabled={rank <= 1}>↑</button><button type="button" onClick={onNext} disabled={rank >= total}>↓</button><button type="button" onClick={onClose}>×</button></div></header>
    <section className="candidate-inspector-identity"><span className="candidate-inspector-source">{label(person.provider)} observation</span><h2>{person.displayName}</h2><p>{[person.currentTitle || person.headline, person.currentEmployer].filter(Boolean).join(' · ') || 'Professional profile'}</p><small>{person.location || 'Location not evidenced'}</small>{links.length > 0 && <div className={styles.profileLinks}>{links.map(item => <a key={`${item.kind}:${item.url}`} href={item.url} target="_blank" rel="noreferrer">{label(item.kind)} ↗</a>)}</div>}</section>
    <div className={styles.inspectorActions}><button type="button" data-primary="true" disabled={!canAct || Boolean(saved)} onClick={onSave}>{saved ? '✓ Saved' : 'Save to role'}</button><button type="button" disabled={!canAct} onClick={onContact}>Find contact</button><button type="button" onClick={onExport}>Export candidate brief</button>{saved?.candidateUrl && <Link href={saved.candidateUrl}>Open saved profile ↗</Link>}</div>
    <section className="candidate-inspector-section"><div className="search-section-title"><span>Recruiter review</span><small>human decision</small></div><div className={styles.reviewActions}><button disabled={!canAct} type="button" onClick={() => onReview('strong_fit')}>✓ Strong</button><button disabled={!canAct} type="button" onClick={() => onReview('possible_fit')}>◌ Review later</button><button disabled={!canAct} type="button" onClick={() => onReview('not_fit')}>× Not fit</button></div><p className={styles.statusNote}>These are recruiter-authored dispositions. SourcingOS does not auto-reject or auto-shortlist.</p></section>
    <section className="candidate-inspector-section"><div className="search-section-title"><span>Why surfaced</span><small>retrieval context</small></div><p className="search-plan-summary">{why(person, plan)}</p>{person.providerExplanation && <p className={styles.statusNote}>Provider context: {person.providerExplanation} This is not a SourcingOS fit judgment.</p>}</section>
    <section className="candidate-inspector-section"><div className="search-section-title"><span>Requirement evidence</span><small>{tally.statedRequirements ? `${tally.supported} evidenced · ${tally.needsVerification} needs verification · ${tally.unknown} no evidence` : 'observation-level'}</small></div>
      {statedAssessments.length ? <div className="requirement-evidence-v41">{statedAssessments.map(item => <div key={item.requirement} data-state={item.state}>
        <div className="requirement-evidence-v41-head"><i aria-hidden="true">{stateMark(item.state)}</i><b>{item.requirement}</b><em>{item.origin === 'must_have' ? 'must have' : 'preferred'}</em><u>{stateLabel(item.state)}</u></div>
        {item.quotedEvidence.length > 0 && <div className="requirement-evidence-v41-quotes">{item.quotedEvidence.map(quote => <blockquote key={quote}>{quote}<cite>{label(person.provider)} observation{person.observedAt ? ` · retrieved ${new Date(person.observedAt).toLocaleDateString()}` : ''}</cite></blockquote>)}</div>}
        <small>{item.rationale}</small>
      </div>)}</div> : <p className="search-empty-copy">Run a people search to compare this candidate against explicit requirements.</p>}
      {expansionTerms.length > 0 && <div className="requirement-expansion-v41"><small>Discovery expansion · search logic, not candidate evidence</small><div>{expansionTerms.map(item => <span key={item.requirement} data-observed={item.state === 'supported'}>{item.requirement}</span>)}</div><p>These terms widened retrieval for this search. They are not requirements and are excluded from the evidence tally above.</p></div>}
    </section>
    {profile?.summary && <section className="candidate-inspector-section"><div className="search-section-title"><span>Profile summary</span><small>provider-observed</small></div><p className="search-plan-summary">{profile.summary}</p></section>}
    <section className="candidate-inspector-section"><div className="search-section-title"><span>Experience</span><small>{profile?.experience?.length || 0}</small></div>{profile?.experience?.length ? <div className={styles.timeline}>{profile.experience.map((item, index) => <div className={styles.timelineItem} key={`${item.title}:${item.company}:${index}`}><strong>{item.title || 'Role'}{item.company ? ` · ${item.company}` : ''}</strong><span>{dateRange(item)}{item.location ? ` · ${item.location}` : ''}</span>{item.description && <p>{item.description}</p>}</div>)}</div> : <p className="search-empty-copy">This source did not return structured experience history. SourcingOS will not invent it.</p>}</section>
    <section className="candidate-inspector-section"><div className="search-section-title"><span>Observed skills</span><small>{person.skills?.length || 0}</small></div>{person.skills?.length ? <div className="inspector-skill-list">{person.skills.slice(0, 24).map(skill => <span key={skill}>{skill}</span>)}</div> : <p className="search-empty-copy">No structured skills were returned by this observation.</p>}</section>
    {!!profile?.education?.length && <section className="candidate-inspector-section"><div className="search-section-title"><span>Education</span><small>{profile.education.length}</small></div><div className={styles.timeline}>{profile.education.map((item, index) => <div className={styles.timelineItem} key={`${item.school}:${index}`}><strong>{[item.degree, item.field].filter(Boolean).join(' · ') || 'Education'}</strong><span>{item.school || 'School not returned'} · {dateRange(item)}</span>{item.description && <p>{item.description}</p>}</div>)}</div></section>}
    {!!profile?.certifications?.length && <section className="candidate-inspector-section"><div className="search-section-title"><span>Certifications</span><small>{profile.certifications.length}</small></div><div className="inspector-skill-list">{profile.certifications.map(item => item.credentialUrl ? <a href={item.credentialUrl} target="_blank" rel="noreferrer" key={item.name}>{item.name} ↗</a> : <span key={item.name}>{item.name}</span>)}</div></section>}
    {!!profile?.projects?.length && <section className="candidate-inspector-section"><div className="search-section-title"><span>Projects / public work</span><small>{profile.projects.length}</small></div><div className={styles.timeline}>{profile.projects.map((item, index) => <div className={styles.timelineItem} key={`${item.name}:${index}`}><strong>{item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.name} ↗</a> : item.name}</strong>{item.technologies?.length && <span>{item.technologies.join(' · ')}</span>}{item.description && <p>{item.description}</p>}</div>)}</div></section>}
    <section className="candidate-inspector-section"><div className="search-section-title"><span>Contact</span><small>recruiter-approved</small></div><div className="inspector-contact-grid"><div><small>Email</small><b>{contactLabel(person.contactAvailability?.email)}</b></div><div><small>Phone</small><b>{contactLabel(person.contactAvailability?.phone)}</b></div></div>{contactPending && <div className={styles.contactApproval}><p>Contact enrichment can consume paid provider credits. Approving runs contact research for this selected candidate only; it does not send outreach or write to an ATS.</p><div className={styles.bulkActions}><button type="button" disabled={!canAct} onClick={onApproveContact}>{working === 'contacts' ? 'Enriching…' : 'Approve contact lookup'}</button><button type="button" onClick={onCancelContact}>Cancel</button></div></div>}{contact && (contacts.primary.length ? <div className="contact-canonical-v41">
      {contacts.conflictingChannels.length > 0 && <p className="contact-conflict-v41">Conflicting values returned for {contacts.conflictingChannels.map(channelLabel).join(', ')}. These may belong to different people and are not merged. Confirm before use.</p>}
      {contacts.primary.map(entry => <div key={`${entry.channel}:${entry.value}`} className="contact-canonical-v41-row"><small>{channelLabel(entry.channel)}</small><b>{entry.value}</b><span data-confidence={entry.confidence}>{confidenceLabel(entry.confidence)}</span><em>{label(entry.provenance)}</em></div>)}
      {contacts.alternates.length > 0 && <details className="contact-alternates-v41"><summary>Other possible contact data · {contacts.alternates.length}</summary>{contacts.alternates.map(entry => <div key={`${entry.channel}:${entry.value}:${entry.provenance}`} className="contact-canonical-v41-row"><small>{channelLabel(entry.channel)}</small><b>{entry.value}</b><span data-confidence={entry.confidence}>{confidenceLabel(entry.confidence)}</span><em>{label(entry.provenance)}</em></div>)}</details>}
    </div> : <p className="search-empty-copy">{contact.error || contact.message}</p>)}<p className={styles.statusNote}>Availability is not ownership verification, deliverability, or permission to contact.</p></section>
    {companyContext && <section className="candidate-inspector-section"><div className="search-section-title"><span>Company context</span><small>derived from this search</small></div>
      <details className="company-context-v41"><summary><b>{companyContext.company}</b><span>{companyContext.observedInSlate} in this slate</span></summary>
        {companyContext.observedTitles.length > 0 && <div><small>Titles observed here</small><p>{companyContext.observedTitles.join(' · ')}</p></div>}
        {companyContext.observedLocations.length > 0 && <div><small>Locations observed here</small><p>{companyContext.observedLocations.join(' · ')}</p></div>}
        {companyContext.adjacentCompanies.length > 0 && <div><small>Adjacent employers this search already found</small><p>{companyContext.adjacentCompanies.join(' · ')}</p></div>}
        <p className="search-empty-copy">Computed from candidates returned by this search only. SourcingOS does not hold industry, headcount, or technology data for this company and will not infer it.</p>
      </details>
    </section>}
    <section className="candidate-inspector-section"><div className="search-section-title"><span>External profiles + provenance</span><small>{person.observedAt ? new Date(person.observedAt).toLocaleDateString() : 'current search'}</small></div>{links.length ? <div className={styles.profileLinks}>{links.map(item => <a key={`${item.kind}:${item.url}`} href={item.url} target="_blank" rel="noreferrer">{label(item.kind)} ↗</a>)}</div> : <p className="search-empty-copy">No external profile URLs were observed. SourcingOS does not synthesize them.</p>}<div className="inspector-provenance"><span>{label(person.provider)}</span></div></section>
    <footer className="search-inspector-trust-footer">Provider observations remain evidence with provenance. Save creates a reviewable Candidate Graph record; it does not silently merge identities or make a hiring decision.</footer>
  </div>
}
