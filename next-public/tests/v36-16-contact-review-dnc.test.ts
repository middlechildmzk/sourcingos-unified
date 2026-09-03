import { describe, expect, it } from 'vitest'
import { summarizeContactSignalsV36_13, contactSupportLabelV36_13 } from '@/lib/people-review-v36-13'

describe('V36.16 contact review permission boundary', () => {
  it('keeps do-not-contact phones in rejected provenance instead of primary channels', () => {
    const summary = summarizeContactSignalsV36_13([
      {
        type: 'phone',
        channelKind: 'mobile_phone',
        value: '+15555550123',
        sourceProvider: 'lusha',
        confidence: 'high',
        permissionStatus: 'do_not_contact',
        ownershipConfidence: 'strong',
        deliverability: 'unknown',
      },
      {
        type: 'phone',
        channelKind: 'work_phone',
        value: '+15555550124',
        sourceProvider: 'signalhire',
        confidence: 'medium',
        permissionStatus: 'unknown',
        ownershipConfidence: 'strong',
        deliverability: 'unknown',
      },
    ])

    expect(summary.mobilePhone.primary).toBeUndefined()
    expect(summary.otherPhone.primary?.value).toBe('+15555550124')
    expect(summary.rejected).toHaveLength(1)
    expect(summary.rejected[0].value).toBe('+15555550123')
    expect(contactSupportLabelV36_13(summary.rejected[0])).toBe('Do not contact')
  })
})
