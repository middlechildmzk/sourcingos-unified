import { describe, expect, it } from 'vitest'
import { SOURCE_CAPABILITIES_V36_7, sourceCapabilityV36_7 } from '@/lib/source-capability-v36-7'

describe('V36.7 source capability registry', () => {
  it('describes recruiter-result capabilities without claiming every source provides everything', () => {
    expect(sourceCapabilityV36_7('github')).toMatchObject({ personSearch: true, avatar: true, profileUrl: true, observedLocation: true })
    expect(sourceCapabilityV36_7('huggingface')).toMatchObject({ personSearch: true, nativeLocation: false, observedLocation: false })
    expect(sourceCapabilityV36_7('npi')).toMatchObject({ personSearch: true, nativeLocation: true, avatar: false })
    expect(sourceCapabilityV36_7('pubmed')).toMatchObject({ personSearch: false, capabilityEvidence: true })
  })

  it('does not claim contact or location support where the current source contract does not provide it', () => {
    expect(SOURCE_CAPABILITIES_V36_7.huggingface?.publicContactSignals).toBe(false)
    expect(SOURCE_CAPABILITIES_V36_7.openalex?.observedLocation).toBe(false)
    expect(SOURCE_CAPABILITIES_V36_7.orcid?.publicContactSignals).toBe(false)
  })
})
