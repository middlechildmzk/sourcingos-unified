import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { sampleJDs } from './data';
import { analyzeRole, buildSynthesisPrompt, demoSourceCandidates, generateCandidateSynthesis, linkPublicSourceProfiles, rediscoverCandidates, sourceCandidatesFromPublicApis, updateProjectMemory, type ProfileLinkInput } from './engine';
import type { AISettings, CandidateStage, FeedbackEvent, IdentityMergeSuggestion, PipelineEntry, ProjectMemory, RoleAnalysis, SourcedCandidate, SourceRun, SourcingMode } from './types';

interface SourcingStore {
  activeTab: string;
  jdText: string;
  mode: SourcingMode;
  roleAnalysis: RoleAnalysis | null;
  sourcedCandidates: SourcedCandidate[];
  selectedCandidateId: string | null;
  sourceRuns: SourceRun[];
  currentRunStatus: 'idle' | 'running' | 'complete' | 'error';
  sourceError: string | null;
  pipeline: PipelineEntry[];
  feedbackEvents: FeedbackEvent[];
  projectMemory: ProjectMemory;
  notes: string[];
  profileLinkStatus: 'idle' | 'running' | 'complete' | 'error';
  profileLinkError: string | null;
  aiSettings: AISettings;
  synthesisPrompt: string;
  setActiveTab: (tab: string) => void;
  setJdText: (text: string) => void;
  setMode: (mode: SourcingMode) => void;
  loadSampleJD: (id: string) => void;
  analyzeCurrentRole: () => void;
  sourceCandidates: () => Promise<void>;
  loadDemoResults: () => void;
  selectCandidate: (id: string) => void;
  updateCandidateStage: (id: string, stage: CandidateStage) => void;
  promoteToPipeline: (candidateId: string) => void;
  linkProfilesForCandidate: (candidateId: string, links: ProfileLinkInput) => Promise<void>;
  confirmCandidateMerge: (candidateId: string) => void;
  rejectCandidateMerge: (candidateId: string) => void;
  synthesizeCandidate: (candidateId: string) => void;
  setAIProvider: (provider: AISettings['provider']) => void;
  addFeedback: (candidateId: string, label: FeedbackEvent['label'], note: string) => void;
  runRediscovery: () => void;
  resetWorkspace: () => void;
}

const starter = sampleJDs[0];
const starterAnalysis = analyzeRole(starter.jd, starter.mode);
const initialMemory: ProjectMemory = { positivePatterns: [], negativePatterns: [], cautionPatterns: [], rediscoveryNotes: ['Run a source search, give feedback, then rediscovery will re-rank the local talent pool.'], updatedAt: new Date().toISOString() };

function updateMerge(candidate: SourcedCandidate, status: IdentityMergeSuggestion['status']): SourcedCandidate {
  if (!candidate.identityMergeSuggestion) return candidate;
  return { ...candidate, identityMergeSuggestion: { ...candidate.identityMergeSuggestion, status }, sourceProfiles: candidate.sourceProfiles.map(p => ({ ...p, status: status === 'confirmed' ? 'linked' : status === 'rejected' ? 'rejected' : p.status })) };
}

export const useSourcingStore = create<SourcingStore>()(
  persist(
    (set, get) => ({
      activeTab: 'intake',
      jdText: starter.jd,
      mode: starter.mode,
      roleAnalysis: starterAnalysis,
      sourcedCandidates: [],
      selectedCandidateId: null,
      sourceRuns: [],
      currentRunStatus: 'idle',
      sourceError: null,
      pipeline: [],
      feedbackEvents: [],
      projectMemory: initialMemory,
      notes: ['Start by analyzing the JD, review the Search Intelligence lanes, source only from real public APIs, then enrich with linked public profiles.'],
      profileLinkStatus: 'idle',
      profileLinkError: null,
      aiSettings: { provider: 'local_only', apiKeyStored: false, privacyMode: 'strict_local' },
      synthesisPrompt: '',
      setActiveTab: (activeTab) => set({ activeTab }),
      setJdText: (jdText) => set({ jdText }),
      setMode: (mode) => set({ mode }),
      loadSampleJD: (id) => {
        const sample = sampleJDs.find(s => s.id === id) || starter;
        const roleAnalysis = analyzeRole(sample.jd, sample.mode);
        set({ jdText: sample.jd, mode: sample.mode, roleAnalysis, activeTab: 'intake', sourcedCandidates: [], selectedCandidateId: null, currentRunStatus: 'idle', sourceError: null, profileLinkError: null, notes: [`Loaded sample: ${sample.name}`, ...get().notes].slice(0, 14) });
      },
      analyzeCurrentRole: () => {
        const { jdText, mode } = get();
        const roleAnalysis = analyzeRole(jdText, mode);
        set({ roleAnalysis, activeTab: 'intake', sourcedCandidates: [], selectedCandidateId: null, sourceError: null, notes: [`Search Intelligence built for: ${roleAnalysis.roleTitle}`, ...get().notes].slice(0, 14) });
      },
      sourceCandidates: async () => {
        const { roleAnalysis } = get();
        if (!roleAnalysis) return;
        set({ currentRunStatus: 'running', sourceError: null, activeTab: 'results' });
        try {
          const { run, candidates } = await sourceCandidatesFromPublicApis(roleAnalysis);
          set(state => ({ currentRunStatus: run.status === 'error' ? 'error' : 'complete', sourceRuns: [run, ...state.sourceRuns], sourcedCandidates: candidates, selectedCandidateId: candidates[0]?.id || null, sourceError: run.errors.length ? run.errors.join(' | ') : null, notes: [`Public API source run complete: ${candidates.length} real candidate record(s). No demo fallback used.`, ...run.notes, ...state.notes].slice(0, 14) }));
        } catch (error) {
          set({ currentRunStatus: 'error', sourceError: error instanceof Error ? error.message : 'Candidate sourcing failed.' });
        }
      },
      loadDemoResults: () => {
        const { roleAnalysis } = get();
        if (!roleAnalysis) return;
        const { run, candidates } = demoSourceCandidates(roleAnalysis);
        set(state => ({ sourcedCandidates: candidates, selectedCandidateId: candidates[0]?.id || null, sourceRuns: [run, ...state.sourceRuns], currentRunStatus: 'complete', sourceError: null, activeTab: 'results', notes: [`Demo-only test records loaded: ${candidates.length}. These are synthetic and not real candidates.`, ...state.notes].slice(0, 14) }));
      },
      selectCandidate: (selectedCandidateId) => set({ selectedCandidateId, activeTab: 'candidate' }),
      updateCandidateStage: (id, stage) => set(state => ({ sourcedCandidates: state.sourcedCandidates.map(c => c.id === id ? { ...c, stage } : c) })),
      promoteToPipeline: (candidateId) => {
        const candidate = get().sourcedCandidates.find(c => c.id === candidateId);
        if (!candidate || candidate.demoOnly) {
          set(state => ({ notes: ['Demo-only records cannot be saved to the real pipeline.', ...state.notes].slice(0, 14) }));
          return;
        }
        const exists = get().pipeline.some(p => p.candidateId === candidateId);
        const entry: PipelineEntry = { id: `pipe-${Date.now()}`, candidateId, stage: 'saved', notes: 'Recruiter-confirmed save. Review contact signals before outreach.', updatedAt: new Date().toISOString() };
        set(state => ({ pipeline: exists ? state.pipeline : [entry, ...state.pipeline], sourcedCandidates: state.sourcedCandidates.map(c => c.id === candidateId ? { ...c, stage: 'saved' } : c), activeTab: 'pipeline', notes: [`Saved ${candidate.name} to pipeline for manual review.`, ...state.notes].slice(0, 14) }));
      },
      linkProfilesForCandidate: async (candidateId, links) => {
        const candidate = get().sourcedCandidates.find(c => c.id === candidateId);
        if (!candidate) return;
        set({ profileLinkStatus: 'running', profileLinkError: null });
        try {
          const enriched = await linkPublicSourceProfiles(candidate, links);
          set(state => ({ sourcedCandidates: state.sourcedCandidates.map(c => c.id === candidateId ? enriched : c), selectedCandidateId: candidateId, activeTab: 'candidate', profileLinkStatus: 'complete', notes: [`Linked public source profiles for ${candidate.name}. Review merge suggestion before confirming.`, ...state.notes].slice(0, 14) }));
        } catch (error) {
          set({ profileLinkStatus: 'error', profileLinkError: error instanceof Error ? error.message : 'Profile linking failed.' });
        }
      },
      confirmCandidateMerge: (candidateId) => set(state => ({ sourcedCandidates: state.sourcedCandidates.map(c => c.id === candidateId ? updateMerge(c, 'confirmed') : c), notes: ['Recruiter confirmed profile link/merge. Source profiles marked linked.', ...state.notes].slice(0, 14) })),
      rejectCandidateMerge: (candidateId) => set(state => ({ sourcedCandidates: state.sourcedCandidates.map(c => c.id === candidateId ? updateMerge(c, 'rejected') : c), notes: ['Recruiter rejected profile link suggestion. Profiles kept separate.', ...state.notes].slice(0, 14) })),
      synthesizeCandidate: (candidateId) => {
        const { roleAnalysis, aiSettings } = get();
        const candidate = get().sourcedCandidates.find(c => c.id === candidateId);
        if (!candidate) return;
        const synthesis = generateCandidateSynthesis(candidate, roleAnalysis || undefined, aiSettings);
        const prompt = buildSynthesisPrompt(candidate, roleAnalysis || undefined);
        set(state => ({ sourcedCandidates: state.sourcedCandidates.map(c => c.id === candidateId ? { ...c, synthesis } : c), synthesisPrompt: prompt, activeTab: 'ai', notes: [`Generated ${synthesis.mode} synthesis for ${candidate.name}.`, ...state.notes].slice(0, 14) }));
      },
      setAIProvider: (provider) => set(state => ({ aiSettings: { ...state.aiSettings, provider, privacyMode: provider === 'local_only' ? 'strict_local' : 'byok_review_required' } })),
      addFeedback: (candidateId, label, note) => {
        const candidate = get().sourcedCandidates.find(c => c.id === candidateId);
        const feedback: FeedbackEvent = { id: `fb-${Date.now()}`, candidateId, label, note, createdAt: new Date().toISOString() };
        const memory = updateProjectMemory(get().projectMemory, feedback, candidate);
        set(state => ({ feedbackEvents: [feedback, ...state.feedbackEvents], projectMemory: memory, notes: [`Feedback saved: ${label}. Project memory updated.`, ...state.notes].slice(0, 14) }));
      },
      runRediscovery: () => {
        const { sourcedCandidates, projectMemory, roleAnalysis } = get();
        const reranked = rediscoverCandidates(sourcedCandidates, projectMemory, roleAnalysis || undefined);
        set(state => ({ sourcedCandidates: reranked, selectedCandidateId: reranked[0]?.id || state.selectedCandidateId, activeTab: 'memory', notes: ['Rediscovery pass complete. Candidate pool re-ranked using local project memory.', ...state.notes].slice(0, 14) }));
      },
      resetWorkspace: () => set({ activeTab: 'intake', jdText: starter.jd, mode: starter.mode, roleAnalysis: starterAnalysis, sourcedCandidates: [], selectedCandidateId: null, sourceRuns: [], currentRunStatus: 'idle', sourceError: null, pipeline: [], feedbackEvents: [], projectMemory: initialMemory, profileLinkStatus: 'idle', profileLinkError: null, synthesisPrompt: '', notes: ['Workspace reset. Analyze the JD, review Search Intelligence lanes, source real public candidates, then enrich profiles.'] })
    }),
    { name: 'sourcingos-core-v15-9' }
  )
);
