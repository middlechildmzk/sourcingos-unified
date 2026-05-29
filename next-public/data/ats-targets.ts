import type { AtsTarget } from '@/lib/jobs-ingestion'

// Curated targets only. These are public ATS board slugs, not scraped pages.
// Start small and expand after QA. Jobs are filtered to recruiting/sourcing/TA roles only.
export const atsTargets: AtsTarget[] = [
  { company: 'Ashby', ats: 'ashby', token: 'ashby', tags: ['startup', 'recruiting-ops'] },
  { company: 'Vercel', ats: 'lever', token: 'vercel', tags: ['technical', 'remote'] },
  { company: 'Stripe', ats: 'greenhouse', token: 'stripe', tags: ['technical', 'enterprise'] },
  { company: 'Databricks', ats: 'greenhouse', token: 'databricks', tags: ['technical', 'ai'] },
  { company: 'Ramp', ats: 'greenhouse', token: 'ramp', tags: ['startup', 'technical'] },
  { company: 'Anthropic', ats: 'greenhouse', token: 'anthropic', tags: ['ai', 'research'] },
  { company: 'Notion', ats: 'greenhouse', token: 'notion', tags: ['startup', 'technical'] },
  { company: 'Figma', ats: 'greenhouse', token: 'figma', tags: ['design', 'technical'] }
]

export const atsTargetNotes = [
  'Only public ATS board endpoints are used.',
  'SourcingOS stores and displays metadata plus short snippets, then links to the original posting.',
  'Target slugs can be removed if an employer requests removal or if a feed returns irrelevant roles.'
]
