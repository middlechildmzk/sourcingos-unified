import 'server-only'

const NPI_ORIGIN = 'https://npiregistry.cms.hhs.gov'

export type AgenticNpiDiscovery = {
  sourceKey: 'npi'
  sourceId: string
  sourceUrl: string
  displayName: string
  headline?: string
  location?: string
  summary?: string
  skills: string[]
  evidence: Array<{ kind: string; label: string; value: string; url?: string; observedAt?: string }>
  identityConfidence: number
  profileQuality: number
}

type NpiSearchInput = {
  taxonomy: string
  locations?: string[]
  limit?: number
}

type NpiApiResult = {
  number?: number | string
  enumeration_type?: string
  basic?: {
    first_name?: string
    middle_name?: string
    last_name?: string
    credential?: string
    status?: string
    enumeration_date?: string
    last_updated?: string
  }
  taxonomies?: Array<{ code?: string; desc?: string; primary?: boolean }>
  addresses?: Array<{ address_purpose?: string; city?: string; state?: string }>
}

type NpiApiResponse = { result_count?: number; results?: NpiApiResult[] }

function text(value: unknown, max = 160): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).replace(/\s+/g, ' ').trim().slice(0, max)
    : ''
}

function uniq(values: string[], max = 12): string[] {
  return Array.from(new Set(values.map(value => text(value)).filter(Boolean))).slice(0, max)
}

function taxonomyFromRole(value: string): string {
  const clean = text(value, 100)
    .replace(/\b(?:senior|sr\.?|junior|jr\.?|lead|principal|staff)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const lower = clean.toLowerCase()
  if (/\bnurse practitioner\b/.test(lower)) return 'Nurse Practitioner'
  if (/\bregistered nurse\b|\brn\b/.test(lower)) return 'Registered Nurse'
  if (/\bphysician assistant\b|\bpa-c\b/.test(lower)) return 'Physician Assistant'
  if (/\bpharmacist\b/.test(lower)) return 'Pharmacist'
  if (/\bphysical therapist\b/.test(lower)) return 'Physical Therapist'
  if (/\boccupational therapist\b/.test(lower)) return 'Occupational Therapist'
  if (/\bdentist\b/.test(lower)) return 'Dentist'
  if (/\bpsychologist\b/.test(lower)) return 'Psychologist'
  if (/\bclinical social worker\b/.test(lower)) return 'Clinical Social Worker'
  if (/\bphysician\b|\bdoctor\b|\bmd\b|\bdo\b/.test(lower)) return 'Physician'
  return clean
}

function broadLocation(value: string | undefined): { city?: string; state?: string } {
  const clean = text(value, 100)
  if (!clean || /remote|nationwide|united states|usa/i.test(clean)) return {}
  const parts = clean.split(',').map(part => part.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const stateToken = parts[parts.length - 1].split(/\s+/)[0] || ''
    return {
      city: parts[0],
      ...(stateToken.length === 2 ? { state: stateToken.toUpperCase() } : {}),
    }
  }
  if (/^[A-Za-z]{2}$/.test(clean)) return { state: clean.toUpperCase() }
  return { city: clean }
}

export async function discoverNpiByTaxonomy(input: NpiSearchInput): Promise<AgenticNpiDiscovery[]> {
  const taxonomy = taxonomyFromRole(input.taxonomy)
  if (taxonomy.length < 3) return []

  const location = broadLocation(input.locations?.[0])
  const params = new URLSearchParams({
    version: '2.1',
    enumeration_type: 'NPI-1',
    taxonomy_description: taxonomy,
    limit: String(Math.min(Math.max(input.limit || 20, 1), 50)),
  })
  if (location.city) params.set('city', location.city)
  if (location.state) params.set('state', location.state)

  const response = await fetch(`${NPI_ORIGIN}/api/?${params.toString()}`, {
    headers: { accept: 'application/json', 'user-agent': 'SourcingOS/1.0 recruiter-controlled-talent-intelligence' },
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  })
  if (!response.ok) throw new Error(`NPI Registry returned ${response.status}.`)

  const data = await response.json() as NpiApiResponse
  return (Array.isArray(data.results) ? data.results : []).flatMap(result => {
    const npi = text(result.number, 20)
    if (!npi || (result.enumeration_type && result.enumeration_type !== 'NPI-1')) return []

    const basic = result.basic || {}
    const name = [basic.first_name, basic.middle_name, basic.last_name].map(value => text(value, 80)).filter(Boolean).join(' ')
    if (!name) return []

    const taxonomies = uniq((result.taxonomies || []).map(item => text(item.desc || item.code, 100)), 8)
    const primaryTaxonomy = text((result.taxonomies || []).find(item => item.primary)?.desc, 100) || taxonomies[0] || taxonomy
    const practice = (result.addresses || []).find(item => item.address_purpose === 'LOCATION') || result.addresses?.[0]
    // Privacy minimization: only broad city/state are retained. Street addresses,
    // postal codes, telephone/fax fields and raw registry payloads never leave this adapter.
    const city = text(practice?.city, 80)
    const state = text(practice?.state, 20)
    const place = [city, state].filter(Boolean).join(', ')
    const sourceUrl = `https://npiregistry.cms.hhs.gov/provider-view/${encodeURIComponent(npi)}`
    const observedAt = text(basic.last_updated || basic.enumeration_date, 40) || undefined

    return [{
      sourceKey: 'npi' as const,
      sourceId: npi,
      sourceUrl,
      displayName: name,
      headline: primaryTaxonomy,
      location: place || undefined,
      summary: `Public CMS NPI Registry provider record${basic.credential ? ` · ${text(basic.credential, 40)}` : ''}.`,
      skills: taxonomies,
      evidence: [
        { kind: 'professional_registry', label: 'NPI Registry record', value: `NPI ${npi}`, url: sourceUrl, observedAt },
        ...(primaryTaxonomy ? [{ kind: 'professional_taxonomy', label: 'Provider taxonomy', value: primaryTaxonomy, url: sourceUrl, observedAt }] : []),
        ...(place ? [{ kind: 'broad_location', label: 'Registry city/state', value: place, url: sourceUrl, observedAt }] : []),
      ],
      identityConfidence: 94,
      profileQuality: Math.min(100, 62 + (taxonomies.length ? 14 : 0) + (place ? 10 : 0) + (basic.credential ? 6 : 0)),
    }]
  }).slice(0, Math.min(Math.max(input.limit || 20, 1), 50))
}
