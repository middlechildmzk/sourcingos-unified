import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { canonicalProfessionalProfileUrlV36_10 } from './identity-anchors-v36-10'

export type CandidateArtifactTypeV36_10 = 'resume' | 'portfolio' | 'profile_export' | 'document' | 'other'
export type CandidateArtifactOriginV36_10 = 'public_web' | 'recruiter_upload' | 'provider' | 'ats_crm' | 'linkedin_connection_import' | 'csv_import' | 'manual'

export type CandidateArtifactV36_10 = {
  id: string
  candidateId?: string
  sourceProfileId?: string
  artifactType: CandidateArtifactTypeV36_10
  dataOrigin: CandidateArtifactOriginV36_10
  fileName?: string
  mimeType?: string
  sourceUrl?: string
  contentSha256: string
  extractionVersion: 'v36.10'
  rawTextLength: number
  identityAnchors: {
    observedEmails: string[]
    professionalProfiles: Array<{
      network: string
      canonicalUrl: string
      observedUrl: string
    }>
  }
  metadata: Record<string, unknown>
  observedAt: string
  createdAt: string
}

function safeHttpUrl(value: unknown): string | undefined {
  const raw = typeof value === 'string' ? value.trim().slice(0, 2000) : ''
  if (!raw) return undefined
  try {
    const parsed = new URL(raw)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : undefined
  } catch {
    return undefined
  }
}

function extractEmails(text: string): string[] {
  return Array.from(new Set((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map(value => value.toLowerCase()))).slice(0, 20)
}

function extractUrls(text: string): string[] {
  return Array.from(new Set(text.match(/https?:\/\/[^\s)\]}>"']+/gi) || [])).slice(0, 80)
}

export function buildCandidateArtifactV36_10(input: {
  text: string
  candidateId?: string
  sourceProfileId?: string
  artifactType?: CandidateArtifactTypeV36_10
  dataOrigin: CandidateArtifactOriginV36_10
  fileName?: string
  mimeType?: string
  sourceUrl?: string
  observedAt?: string
  metadata?: Record<string, unknown>
}): CandidateArtifactV36_10 {
  const text = String(input.text || '')
  const urls = extractUrls(text)
  const professionalProfiles = Array.from(new Map(
    urls
      .map(canonicalProfessionalProfileUrlV36_10)
      .filter((anchor): anchor is NonNullable<typeof anchor> => Boolean(anchor))
      .map(anchor => [`${anchor.network}:${anchor.canonicalUrl}`, anchor]),
  ).values())
  const createdAt = new Date().toISOString()

  return {
    id: randomUUID(),
    candidateId: input.candidateId,
    sourceProfileId: input.sourceProfileId,
    artifactType: input.artifactType || 'document',
    dataOrigin: input.dataOrigin,
    fileName: input.fileName?.trim().slice(0, 240) || undefined,
    mimeType: input.mimeType?.trim().slice(0, 160) || undefined,
    sourceUrl: safeHttpUrl(input.sourceUrl),
    contentSha256: createHash('sha256').update(text, 'utf8').digest('hex'),
    extractionVersion: 'v36.10',
    rawTextLength: text.length,
    identityAnchors: {
      observedEmails: extractEmails(text),
      professionalProfiles,
    },
    metadata: input.metadata || {},
    observedAt: input.observedAt || createdAt,
    createdAt,
  }
}

export async function persistCandidateArtifactV36_10(input: {
  sb: any
  ownerId: string
  artifact: CandidateArtifactV36_10
}): Promise<{ ok: boolean; persisted: boolean; warning?: string }> {
  const { artifact } = input
  const { error } = await input.sb.from('candidate_artifacts').insert({
    id: artifact.id,
    owner_id: input.ownerId,
    candidate_id: artifact.candidateId || null,
    source_profile_id: artifact.sourceProfileId || null,
    artifact_type: artifact.artifactType,
    data_origin: artifact.dataOrigin,
    file_name: artifact.fileName || null,
    mime_type: artifact.mimeType || null,
    source_url: artifact.sourceUrl || null,
    content_sha256: artifact.contentSha256,
    extraction_version: artifact.extractionVersion,
    raw_text_length: artifact.rawTextLength,
    identity_anchors: artifact.identityAnchors,
    metadata: artifact.metadata,
    observed_at: artifact.observedAt,
    created_at: artifact.createdAt,
    updated_at: artifact.createdAt,
  })

  if (!error) return { ok: true, persisted: true }
  const missingTable = error.code === '42P01' || /candidate_artifacts|relation .* does not exist/i.test(String(error.message || ''))
  if (missingTable) {
    return {
      ok: true,
      persisted: false,
      warning: 'Candidate artifact table is not migrated in this environment yet; the candidate/source profile was saved but artifact metadata remains pending.',
    }
  }
  return { ok: false, persisted: false, warning: `Candidate artifact write failed: ${error.message}` }
}
