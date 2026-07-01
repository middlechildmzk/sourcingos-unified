import type { JobSourceType } from '@/lib/jobs-ingestion'

export type JobSourceAccess = 'public_api' | 'public_ats' | 'official_optional' | 'manual_review'

export type JobSourceDefinition = {
  id: string
  sourceType: JobSourceType | 'remoteok' | 'jobicy' | 'himalayas'
  label: string
  access: JobSourceAccess
  enabledByDefault: boolean
  persistEligible: boolean
  termsNote: string
  priority: 'high' | 'medium' | 'low'
}

export const jobSourceRegistry: JobSourceDefinition[] = [
  {
    id: 'ats',
    sourceType: 'manual-curation',
    label: 'Curated company ATS feeds',
    access: 'public_ats',
    enabledByDefault: true,
    persistEligible: true,
    termsNote: 'Uses selected public employer job-board feeds and links to the original posting.',
    priority: 'high',
  },
  {
    id: 'greenhouse',
    sourceType: 'greenhouse',
    label: 'Greenhouse public boards',
    access: 'public_ats',
    enabledByDefault: true,
    persistEligible: true,
    termsNote: 'Public board metadata. Store snippets and original apply links.',
    priority: 'high',
  },
  {
    id: 'lever',
    sourceType: 'lever',
    label: 'Lever public postings',
    access: 'public_ats',
    enabledByDefault: true,
    persistEligible: true,
    termsNote: 'Public posting metadata. Store snippets and original apply links.',
    priority: 'high',
  },
  {
    id: 'ashby',
    sourceType: 'ashby',
    label: 'Ashby public job boards',
    access: 'public_ats',
    enabledByDefault: true,
    persistEligible: true,
    termsNote: 'Public posting metadata. Store snippets and original apply links.',
    priority: 'high',
  },
  {
    id: 'usajobs',
    sourceType: 'usajobs',
    label: 'USAJOBS optional official API',
    access: 'official_optional',
    enabledByDefault: true,
    persistEligible: false,
    termsNote: 'Official API when configured. Use for search and link back to the source.',
    priority: 'medium',
  },
  {
    id: 'arbeitnow',
    sourceType: 'arbeitnow',
    label: 'Arbeitnow public feed',
    access: 'public_api',
    enabledByDefault: true,
    persistEligible: false,
    termsNote: 'Public feed. Use for live search unless reviewed for persistence.',
    priority: 'medium',
  },
  {
    id: 'remotive',
    sourceType: 'remotive',
    label: 'Remotive live feed',
    access: 'public_api',
    enabledByDefault: true,
    persistEligible: false,
    termsNote: 'Use with clear attribution and source links. Do not gate Remotive listings behind signup.',
    priority: 'low',
  },
]

export function sourceLabelsFor(ids: string[]) {
  const byId = new Map(jobSourceRegistry.map(source => [source.id, source.label]))
  return ids.map(id => byId.get(id) || id)
}
