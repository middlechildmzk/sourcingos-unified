import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const provider = read('lib/ai/provider.ts')
const gatewayStatus = read('lib/ai/gateway-v39-1.ts')
const searchRoute = read('app/api/candidate-data/search/route.ts')
const capture = read('lib/candidate-data/auto-capture-v40.ts')
const captureStore = read('lib/candidate-data/capture-source-result-v40.ts')
const identityProposals = read('lib/identity-proposal-service-v33-2.ts')
const identityReviewRoute = read('app/api/candidate-db/match-review/route.ts')
const identityDecisionRoute = read('app/api/candidate-db/confirm-merge/route.ts')
const identityInbox = read('components/IdentityReviewInboxV36_10.tsx')
const workspace = read('components/SearchWorkspaceV38_1.tsx')
const workspaceCss = read('components/SearchWorkspaceV38_1.module.css')

describe('V40 agentic sourcing foundation', () => {
  it('routes the reasoning abstraction through Vercel AI Gateway when gateway auth is present', () => {
    expect(provider).toContain("https://ai-gateway.vercel.sh/v1/responses")
    expect(provider).toContain('process.env.VERCEL_OIDC_TOKEN')
    expect(provider).toContain('process.env.AI_GATEWAY_API_KEY')
    expect(provider).toContain("return 'vercel_gateway'")
    expect(provider).toContain("'openai/gpt-5.6-sol'")
    expect(provider).toContain("if (legacyModel?.includes('/')) return legacyModel")
    expect(provider).not.toContain("process.env.AI_GATEWAY_MODEL?.trim() || process.env.AI_PROVIDER_MODEL?.trim() || 'openai/gpt-5.6-sol'")
    expect(gatewayStatus).toContain('gatewayRequestRuntimeIntegrated: true')
    expect(gatewayStatus).toContain('aiSdkRuntimeIntegrated: false')
  })

  it('automatically captures retained source-native observations into durable SourcingOS memory', () => {
    expect(searchRoute).toContain('autoCaptureSearchObservationsV40')
    expect(searchRoute).toContain('autoCapture = await autoCaptureSearchObservationsV40')
    expect(searchRoute).toContain('retainedObservationsPersistedAutomatically: autoCapture.enabled')
    expect(searchRoute).toContain('autoCapture,')
    expect(captureStore).toContain("status: 'pending'")
    expect(captureStore).toContain("merge_status: 'pending'")
    expect(captureStore).toContain('Automatically captured ${normalized.source} observation.')
  })

  it('hands deterministic cross-source anchors to the existing recruiter identity inbox without auto-merging', () => {
    expect(captureStore).toContain('createDeterministicIdentityProposals')
    expect(capture).toContain('identityReviewProposalsCreated')
    expect(capture).toContain('identityResolutionDeferred: true')
    expect(identityProposals).toContain('This function never links source profiles')
    expect(identityProposals).toContain('!comparison.deterministicAnchor')
    expect(identityProposals).toContain('LinkedIn overlap is review context only')
    expect(identityReviewRoute).toContain('mergeAuthorized: false')
    expect(identityReviewRoute).toContain('reviewRequired: true')
    expect(identityInbox).toContain('Identity confidence is not merge permission.')
    expect(identityInbox).toContain('Confirm same person')
    expect(identityInbox).toContain('Keep separate')
    expect(identityDecisionRoute).toContain("sb.rpc('confirm_identity_match_atomic_v34'")
    expect(identityDecisionRoute).toContain('recruiter action required for every merge decision')
  })

  it('makes agent execution and durable capture visible in the recruiter cockpit', () => {
    expect(workspace).toContain('AI sourcing copilot')
    expect(workspace).toContain('Agent activity')
    expect(workspace).toContain('Understand brief')
    expect(workspace).toContain('Orchestrate sources')
    expect(workspace).toContain('Capture memory')
    expect(workspace).toContain('Review ready')
    expect(workspace).toContain('capture.persisted')
    expect(workspace).toContain('Discoveries captured. Review the slate.')
    expect(workspace).toContain('Add all to role')
    expect(workspaceCss).toContain('.agentPipeline')
    expect(workspaceCss).toContain(".search-workspace-right.has-selection")
  })

  it('keeps automatic capture outside contact reveal, identity merge, and recruiter decision authority', () => {
    expect(capture).toContain('contactValuesCaptured: false')
    expect(capture).not.toContain("from('candidate_contacts')")
    expect(searchRoute).toContain('contactValuesCapturedAutomatically: false')
    expect(searchRoute).toContain('automaticIdentityResolutionDeferred: true')
    expect(searchRoute).toContain('identityMergePerformed: false')
    expect(searchRoute).toContain('recruiterDecisionPerformed: false')
  })
})
