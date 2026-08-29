import 'server-only'
import {
  dedupeOrganizationSignals,
  signalFreshnessDays,
  type OrganizationSignal,
} from './organization-signals-v31'

const USASPENDING_ORIGIN = 'https://api.usaspending.gov'
const CONTRACT_AWARD_TYPES = ['A', 'B', 'C', 'D'] as const

export type UsaSpendingSignalInput = {
  query: string
  limit?: number
}

type AwardRow = {
  'Award ID'?: string
  'Recipient Name'?: string
  'Awarding Agency'?: string
  'Awarding Sub Agency'?: string
  'Funding Agency'?: string
  'Description'?: string
  'Start Date'?: string
  'End Date'?: string
  'Base Obligation Date'?: string
  'Award Amount'?: number
  'Contract Award Type'?: string
  generated_internal_id?: string
  'Last Modified Date'?: string
}

type AwardResponse = { results?: AwardRow[] }

function text(value: unknown, max = 500): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).replace(/\s+/g, ' ').trim().slice(0, max)
    : ''
}

function isoDate(value: unknown): string | undefined {
  const raw = text(value, 40)
  if (!raw) return undefined
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

function dateWindow(now = new Date()) {
  const start = new Date(now)
  start.setUTCFullYear(start.getUTCFullYear() - 2)
  return {
    start_date: start.toISOString().slice(0, 10),
    end_date: now.toISOString().slice(0, 10),
  }
}

export async function discoverUsaSpendingSignals(input: UsaSpendingSignalInput): Promise<OrganizationSignal[]> {
  const query = text(input.query, 240)
  if (query.length < 3) return []
  const limit = Math.min(Math.max(input.limit || 20, 1), 50)

  const response = await fetch(`${USASPENDING_ORIGIN}/api/v2/search/spending_by_award/`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'user-agent': 'SourcingOS/1.0 recruiter-controlled-talent-intelligence',
    },
    body: JSON.stringify({
      spending_level: 'awards',
      filters: {
        award_type_codes: CONTRACT_AWARD_TYPES,
        keywords: [query],
        time_period: [dateWindow()],
      },
      fields: [
        'Award ID',
        'Recipient Name',
        'Awarding Agency',
        'Awarding Sub Agency',
        'Funding Agency',
        'Description',
        'Start Date',
        'End Date',
        'Base Obligation Date',
        'Award Amount',
        'Contract Award Type',
        'Last Modified Date',
        'generated_internal_id',
      ],
      limit,
      page: 1,
      sort: 'Start Date',
      order: 'desc',
      subawards: false,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`USAspending returned ${response.status}.`)

  const payload = await response.json() as AwardResponse
  const now = new Date()
  const observedAt = now.toISOString()
  const signals = (Array.isArray(payload.results) ? payload.results : []).flatMap(row => {
    const organization = text(row['Recipient Name'], 180)
    const awardId = text(row['Award ID'], 120)
    if (!organization || !awardId) return []

    const generatedId = text(row.generated_internal_id, 240)
    const sourceUrl = generatedId
      ? `https://www.usaspending.gov/award/${encodeURIComponent(generatedId)}/`
      : 'https://www.usaspending.gov/'
    const agency = text(row['Awarding Agency'] || row['Funding Agency'], 180)
    const description = text(row.Description, 700)
    const eventDate = isoDate(row['Base Obligation Date'] || row['Start Date'])
    const amountValue = Number(row['Award Amount'])
    const amount = Number.isFinite(amountValue) ? amountValue : undefined
    const awardType = text(row['Contract Award Type'], 100)

    return [{
      id: `usaspending:${awardId}:${organization}`.toLowerCase().replace(/[^a-z0-9:.-]+/g, '-').slice(0, 300),
      source: 'usaspending' as const,
      kind: 'contract_award' as const,
      organization,
      headline: `${awardType || 'Federal contract award'}${agency ? ` · ${agency}` : ''}`,
      whyNow: `A public federal contract award matched the role's public-safe search terms. This makes ${organization} an organization to inspect as a possible talent ecosystem; it says nothing about any individual's availability, interest, or job fit.`,
      sourceUrl,
      sourceRecordId: awardId,
      agency: agency || undefined,
      description: description || undefined,
      amount,
      eventDate,
      observedAt,
      freshnessDays: signalFreshnessDays(eventDate, now),
    }]
  })

  return dedupeOrganizationSignals(signals).slice(0, limit)
}
