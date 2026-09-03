import { afterEach, describe, expect, it, vi } from 'vitest'
import { enrichWithPeopleDataLabs } from '@/lib/contact-enrichment/providers/people-data-labs'
import { enrichWithSignalHireV36_8 } from '@/lib/contact-enrichment/providers/signalhire-v36-8'
import { buildCandidateSummary, evidenceFromText, inferOpenToWorkSignals, type SourceProfileRecord } from '@/lib/candidate-db-v18'

const originalPdl = process.env.PDL_API_KEY
const originalSignalHire = process.env.SIGNALHIRE_API_KEY

afterEach(() => {
  vi.unstubAllGlobals()
  if (originalPdl === undefined) delete process.env.PDL_API_KEY
  else process.env.PDL_API_KEY = originalPdl
  if (originalSignalHire === undefined) delete process.env.SIGNALHIRE_API_KEY
  else process.env.SIGNALHIRE_API_KEY = originalSignalHire
})

describe('V36.12 provider contact subtype truth', () => {
  it('maps PDL direct work, personal and mobile fields without implying permission', async () => {
    process.env.PDL_API_KEY = 'test-key'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      data: {
        id: 'pdl-test-person',
        full_name: 'Alex Example',
        job_title: 'Systems Engineer',
        job_company_name: 'ExampleCo',
        work_email: 'alex.work@example.com',
        recommended_personal_email: 'alex.personal@example.com',
        mobile_phone: '+1 555 010 1000',
        emails: [{ address: 'alex.work@example.com', type: 'work' }],
        phone_numbers: [{ number: '+1 555 010 1000', type: 'mobile' }],
      },
      likelihood: 9,
      matched: ['name', 'company'],
    }), { status: 200, headers: { 'content-type': 'application/json' } })))

    const result = await enrichWithPeopleDataLabs({ fullName: 'Alex Example', currentCompany: 'ExampleCo' })
    expect(result.signals).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'email', channelKind: 'work_email', value: 'alex.work@example.com', permissionStatus: 'unknown', verified: false }),
      expect.objectContaining({ type: 'email', channelKind: 'personal_email', value: 'alex.personal@example.com', permissionStatus: 'unknown', verified: false }),
      expect.objectContaining({ type: 'phone', channelKind: 'mobile_phone', value: '+1 555 010 1000', permissionStatus: 'unknown', verified: false }),
    ]))
    expect(result.signals.filter(signal => signal.value === 'alex.work@example.com')).toHaveLength(1)
    expect(result.signals.filter(signal => signal.value === '+1 555 010 1000')).toHaveLength(1)
  })

  it('preserves SignalHire contact subType labels', async () => {
    process.env.SIGNALHIRE_API_KEY = 'test-key'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([{
      status: 'success',
      candidate: {
        uid: 'signalhire-test-person',
        fullName: 'Alex Example',
        contacts: [
          { type: 'email', subType: 'work', value: 'alex.work@example.com', rating: 100 },
          { type: 'email', subType: 'personal', value: 'alex.private@example.com', rating: 90 },
          { type: 'phone', subType: 'mobile', value: '+1 555 010 1000', rating: 90 },
        ],
      },
    }]), { status: 200, headers: { 'content-type': 'application/json' } })))

    const result = await enrichWithSignalHireV36_8({ providerName: 'signalhire', providerPersonId: 'signalhire-test-person' })
    expect(result.signals).toEqual(expect.arrayContaining([
      expect.objectContaining({ channelKind: 'work_email' }),
      expect.objectContaining({ channelKind: 'personal_email' }),
      expect.objectContaining({ channelKind: 'mobile_phone' }),
    ]))
  })
})

describe('V36.12 resume truth guardrails', () => {
  it('does not infer open-to-work merely because a resume or CV exists', () => {
    expect(inferOpenToWorkSignals('Resume for Alex Example. Linux administrator.', 'uploaded_resume')).toEqual([])
    expect(inferOpenToWorkSignals('Curriculum Vitae — Alex Example', 'uploaded_resume')).toEqual([])
    expect(inferOpenToWorkSignals('Experienced civic systems engineer', 'uploaded_resume')).toEqual([])
    expect(inferOpenToWorkSignals('Open to work for infrastructure roles', 'uploaded_resume')).toEqual([
      expect.objectContaining({ label: 'Public open-to-work wording', requiresReview: true }),
    ])
  })

  it('does not feed generated evidence back into scalar skill extraction', () => {
    const sourceProfile: SourceProfileRecord = {
      id: 'source-profile-test',
      source: 'uploaded_resume',
      sourceProfileId: 'resume-test',
      displayName: 'Alex Example',
      rawText: 'Experienced Linux administrator.',
      status: 'pending',
      matchScore: 0,
      matchReasons: [],
      lastSeenAt: '2026-09-03T00:00:00.000Z',
      createdAt: '2026-09-03T00:00:00.000Z',
    }
    const unrelatedEvidence = evidenceFromText('Python machine learning', 'manual')
    const summary = buildCandidateSummary(sourceProfile, unrelatedEvidence)
    expect(summary.skills).toContain('linux')
    expect(summary.skills).not.toContain('python')
    expect(summary.skills).not.toContain('machine learning')
  })
})
