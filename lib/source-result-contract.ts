// ─────────────────────────────────────────────────────────────────────────────
// SourcingOS source-result request contract - V29.2.1.
//
// Client request bodies are untrusted input. Before V29.2.1 the candidate save
// route accepted `z.array(z.any())` and persisted a client-authored candidate
// graph verbatim, which meant a manipulated client could submit its own
// grouping, its own entityKind, its own skills and its own contact signals.
//
// This module validates shape only. It deliberately does not decide truth.
// Subject classification, skill hygiene and contact hygiene are re-derived
// server-side by lib/entity-classification. A `entityKind` present in a request
// body is parsed so the payload is well formed and then discarded downstream.
// ─────────────────────────────────────────────────────────────────────────────
import { z } from 'zod'
import { allSourceNames, SourceName } from './source-types'

const sourceEnum = z.enum(allSourceNames as [SourceName, ...SourceName[]])

const entityKindEnum = z.enum([
  'person',
  'organization',
  'artifact',
  'publication',
  'search_lane',
  'unknown',
])

const shortText = z.string().max(400)
const urlText = z.string().max(2048)

const evidenceItemSchema = z.object({
  id: z.string().min(1).max(200),
  label: shortText,
  detail: z.string().max(2000),
  source: sourceEnum,
  confidence: z.enum(['high', 'medium', 'low']),
  url: urlText.optional(),
  observedAt: z.string().max(40),
})

const contactSignalSchema = z.object({
  type: z.enum(['public_email', 'website', 'profile_url', 'location', 'organization']),
  value: shortText,
  source: sourceEnum,
  // A client may not assert verification. The literal is the guardrail.
  verified: z.literal(false),
  note: z.string().max(600),
})

const identitySignalSchema = z.object({
  type: z.enum(['name', 'location', 'website', 'email', 'skill', 'organization', 'source_url']),
  value: shortText,
  weight: z.number().min(0).max(100),
  source: sourceEnum,
})

export const sourceResultSchema = z.object({
  id: z.string().min(1).max(300),
  source: sourceEnum,
  sourceProfileId: z.string().min(1).max(300),
  entityKind: entityKindEnum,
  displayName: shortText,
  headline: shortText.optional(),
  location: shortText.optional(),
  organization: shortText.optional(),
  profileUrl: urlText.optional(),
  avatarUrl: urlText.optional(),
  skills: z.array(z.string().max(120)).max(200).default([]),
  evidence: z.array(evidenceItemSchema).max(200).default([]),
  contactSignals: z.array(contactSignalSchema).max(50).default([]),
  identitySignals: z.array(identitySignalSchema).max(200).default([]),
  refreshedAt: z.string().max(40),
  raw: z.unknown().optional(),
})

export type SourceResultRequest = z.infer<typeof sourceResultSchema>

/**
 * Legacy grouped shape. Accepted for request compatibility only. The grouping
 * is discarded: only the flat source profiles inside it are read, and they are
 * re-resolved server-side. A client cannot submit a merge decision.
 */
const legacyCandidateGroupSchema = z.object({
  sourceProfiles: z.array(sourceResultSchema).max(200).default([]),
})

export const candidateSaveRequestSchema = z
  .object({
    sourceResults: z.array(sourceResultSchema).max(200).optional(),
    candidateGraph: z.array(legacyCandidateGroupSchema).max(200).optional(),
  })
  .refine(
    body => Boolean(body.sourceResults?.length || body.candidateGraph?.length),
    { message: 'Provide sourceResults with at least one source result.' },
  )

export type CandidateSaveRequest = z.infer<typeof candidateSaveRequestSchema>

/**
 * Flatten a save request into untrusted flat source results, dropping any
 * client-submitted grouping.
 */
export function flattenSaveRequest(body: CandidateSaveRequest): {
  results: SourceResultRequest[]
  discardedClientGroupings: number
} {
  const results: SourceResultRequest[] = [...(body.sourceResults ?? [])]
  let discardedClientGroupings = 0

  for (const group of body.candidateGraph ?? []) {
    if (group.sourceProfiles.length > 1) discardedClientGroupings += 1
    results.push(...group.sourceProfiles)
  }

  return { results, discardedClientGroupings }
}
