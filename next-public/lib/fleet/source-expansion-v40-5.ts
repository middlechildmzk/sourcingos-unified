import 'server-only'

/**
 * V40.5 source expansion registry.
 *
 * This registry is deliberately policy-first. A source being useful for talent
 * research does not mean SourcingOS is authorized to crawl it. Runtime adapters
 * may only activate entries whose current access mode has been independently
 * verified and whose terms/robots/credentials allow the requested operation.
 */
export type SourceExpansionAccessV40_5 =
  | 'official_public_api'
  | 'official_api_credentials'
  | 'public_index_or_document'
  | 'metadata_only'
  | 'partner_or_terms_review'
  | 'batch_public_corpus'

export type SourceExpansionTargetV40_5 = {
  key: string
  label: string
  access: SourceExpansionAccessV40_5
  domains: string[]
  purposes: Array<'person_discovery' | 'technical_evidence' | 'resume_cv' | 'portfolio' | 'research' | 'batch_ingestion'>
  priority: 1 | 2 | 3
  notes: string
}

export const SOURCE_EXPANSION_TARGETS_V40_5: SourceExpansionTargetV40_5[] = [
  { key: 'gitlab', label: 'GitLab', access: 'official_public_api', domains: ['gitlab.com'], purposes: ['person_discovery','technical_evidence','portfolio'], priority: 1, notes: 'Use documented public-user/project surfaces only. Public contact fields are not ingested into unattended contact storage.' },
  { key: 'hackernews', label: 'Hacker News', access: 'official_public_api', domains: ['news.ycombinator.com'], purposes: ['person_discovery','technical_evidence'], priority: 1, notes: 'Use the official Firebase API; employment-interest posts remain source-stated observations.' },
  { key: 'producthunt', label: 'Product Hunt', access: 'official_api_credentials', domains: ['producthunt.com'], purposes: ['person_discovery','portfolio'], priority: 2, notes: 'Activate only with approved API credentials and current API terms.' },
  { key: 'devto', label: 'DEV Community', access: 'official_public_api', domains: ['dev.to'], purposes: ['person_discovery','technical_evidence','portfolio'], priority: 1, notes: 'Prefer official Forem/DEV API surfaces.' },
  { key: 'huggingface', label: 'Hugging Face Hub', access: 'official_public_api', domains: ['huggingface.co'], purposes: ['person_discovery','technical_evidence','portfolio'], priority: 1, notes: 'Use Hub API/OpenAPI and respect published rate limits.' },
  { key: 'openalex', label: 'OpenAlex', access: 'official_public_api', domains: ['openalex.org'], purposes: ['person_discovery','research'], priority: 1, notes: 'Academic/research identity and affiliation evidence with provenance.' },
  { key: 'arxiv', label: 'arXiv', access: 'official_public_api', domains: ['arxiv.org'], purposes: ['person_discovery','research'], priority: 1, notes: 'Use supported API/OAI metadata. Paper authorship is not an employment claim.' },
  { key: 'kaggle', label: 'Kaggle', access: 'official_api_credentials', domains: ['kaggle.com'], purposes: ['person_discovery','technical_evidence','portfolio'], priority: 2, notes: 'Credentialed adapter only; never infer skills from search terms alone.' },

  { key: 'public_drive', label: 'Public Google Drive / Docs', access: 'public_index_or_document', domains: ['drive.google.com','docs.google.com'], purposes: ['resume_cv','portfolio'], priority: 1, notes: 'Only already-public, search-indexed or explicitly linked documents. Never guess file IDs or enumerate folders.' },
  { key: 'public_s3', label: 'Public S3 documents', access: 'public_index_or_document', domains: ['amazonaws.com'], purposes: ['resume_cv','portfolio'], priority: 1, notes: 'Only already-public, linked/indexed object URLs. Never enumerate buckets.' },
  { key: 'public_dropbox', label: 'Public Dropbox documents', access: 'public_index_or_document', domains: ['dropbox.com','dropboxusercontent.com'], purposes: ['resume_cv','portfolio'], priority: 2, notes: 'Only explicit public links discovered from public search/pages.' },
  { key: 'github_pages', label: 'GitHub Pages', access: 'public_index_or_document', domains: ['github.io'], purposes: ['resume_cv','portfolio','technical_evidence'], priority: 1, notes: 'Public personal sites and published documents; respect robots and site terms.' },
  { key: 'vercel_portfolios', label: 'Vercel-hosted public portfolios', access: 'public_index_or_document', domains: ['vercel.app'], purposes: ['resume_cv','portfolio'], priority: 2, notes: 'Search-indexed/linked personal sites only; do not enumerate deployments.' },
  { key: 'netlify_portfolios', label: 'Netlify-hosted public portfolios', access: 'public_index_or_document', domains: ['netlify.app'], purposes: ['resume_cv','portfolio'], priority: 2, notes: 'Search-indexed/linked personal sites only.' },
  { key: 'carrd', label: 'Carrd', access: 'public_index_or_document', domains: ['carrd.co'], purposes: ['portfolio'], priority: 2, notes: 'Public profile/portfolio pages only.' },
  { key: 'aboutme', label: 'About.me', access: 'public_index_or_document', domains: ['about.me'], purposes: ['portfolio'], priority: 2, notes: 'Public profile pages only.' },
  { key: 'academic_cv_web', label: 'University / organization CV pages', access: 'public_index_or_document', domains: ['edu','org'], purposes: ['resume_cv','research'], priority: 1, notes: 'Public CVs and bios with source URL, retention, and identity corroboration.' },

  { key: 'scribd', label: 'Scribd', access: 'metadata_only', domains: ['scribd.com'], purposes: ['resume_cv'], priority: 3, notes: 'Search-result metadata may identify a lead; no subscription/login/paywall bypass or unattended deep retrieval.' },
  { key: 'slideshare', label: 'SlideShare', access: 'metadata_only', domains: ['slideshare.net'], purposes: ['resume_cv','portfolio'], priority: 3, notes: 'Treat as metadata-only until current retrieval rights/terms are verified.' },
  { key: 'researchgate', label: 'ResearchGate', access: 'metadata_only', domains: ['researchgate.net'], purposes: ['research','resume_cv'], priority: 3, notes: 'Public search context only unless an approved API/rights path is established.' },
  { key: 'academia', label: 'Academia.edu', access: 'metadata_only', domains: ['academia.edu'], purposes: ['research','resume_cv'], priority: 3, notes: 'Public search context only unless current terms permit retrieval.' },
  { key: 'issuu', label: 'Issuu', access: 'metadata_only', domains: ['issuu.com'], purposes: ['resume_cv','portfolio'], priority: 3, notes: 'Do not bypass viewer/download restrictions.' },

  { key: 'wellfound', label: 'Wellfound', access: 'partner_or_terms_review', domains: ['wellfound.com'], purposes: ['person_discovery'], priority: 3, notes: 'Do not assume a public GraphQL surface is authorized for automated sourcing; require current partner/API/terms approval.' },
  { key: 'behance', label: 'Behance', access: 'partner_or_terms_review', domains: ['behance.net'], purposes: ['person_discovery','portfolio'], priority: 3, notes: 'Activate only through a currently supported official/authorized access path.' },
  { key: 'dribbble', label: 'Dribbble', access: 'partner_or_terms_review', domains: ['dribbble.com'], purposes: ['person_discovery','portfolio'], priority: 3, notes: 'Activate only through a currently supported official/authorized access path.' },
  { key: 'artstation', label: 'ArtStation', access: 'partner_or_terms_review', domains: ['artstation.com'], purposes: ['person_discovery','portfolio'], priority: 3, notes: 'Public pages may be search leads; automated collection requires current terms review.' },

  { key: 'commoncrawl', label: 'Common Crawl', access: 'batch_public_corpus', domains: ['commoncrawl.org'], purposes: ['resume_cv','portfolio','batch_ingestion'], priority: 2, notes: 'Use as a separate governed batch/index pipeline, not a Vercel cron spider. Preserve source URL and robots/rights policy at retrieval time.' },
  { key: 'gharchive', label: 'GH Archive', access: 'batch_public_corpus', domains: ['gharchive.org'], purposes: ['technical_evidence','batch_ingestion'], priority: 2, notes: 'Use public event history as technical activity evidence; do not turn commit emails into unattended contact records.' },
  { key: 'stackexchange_dump', label: 'Stack Exchange public data dump', access: 'batch_public_corpus', domains: ['archive.org','stackexchange.com'], purposes: ['person_discovery','technical_evidence','batch_ingestion'], priority: 2, notes: 'Honor attribution/license requirements and keep site-level provenance.' },
]

export const V40_5_HARD_PROHIBITIONS = [
  'authentication bypass',
  'paywall bypass',
  'captcha bypass',
  'anti-bot or Cloudflare evasion',
  'rotating residential proxy evasion',
  'stealth or undetected browser automation',
  'private Discord or Slack collection without explicit authorization',
  'Google Drive identifier guessing',
  'cloud bucket enumeration',
  'unattended contact-value harvesting',
] as const

export const V40_5_FIRST_ENRICHMENT_COHORT = {
  source: 'recruiter_uploaded_linkedin_connections',
  policy: 'Use recruiter-uploaded name/company/title/profile context as an enrichment seed. Never use it to authorize LinkedIn scraping.',
  priority: 1,
} as const
