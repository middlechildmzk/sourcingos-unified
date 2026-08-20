import type { Article } from '@/data/articles'

type ArticleOverride = Pick<Article, 'title' | 'description' | 'category'> & { updatedAt: string }

export const tierAArticleOverrides: Record<string, ArticleOverride> = {
  'source-pack-methodology': {
    title: 'The Source Pack Methodology: A Search Operating System for Hard-to-Fill Roles',
    description: 'Turn a difficult requisition into evidence requirements, search lanes, donor companies, Boolean queries, false-positive rules, calibration questions, and explicit stop conditions.',
    category: 'Sourcing Methodology',
    updatedAt: '2026-08-20',
  },
  'github-xray-sourcing': {
    title: 'GitHub X-Ray Sourcing for Recruiters: Search Public Technical Evidence Without Scraping',
    description: 'Use Google site search and GitHub native search to discover public technical evidence, build debuggable sourcing lanes, reduce tutorial noise, and keep fit decisions human-reviewed.',
    category: 'Technical Sourcing',
    updatedAt: '2026-08-20',
  },
  'how-to-source-ai-ml-engineers': {
    title: 'How to Source AI and Machine Learning Engineers in 2026: Evidence Lanes Beyond Job Titles',
    description: 'A recruiter-first AI/ML sourcing playbook using GitHub, Hugging Face, OpenAlex, technical artifacts, production-system evidence, and donor-company maps.',
    category: 'AI/ML Recruiting',
    updatedAt: '2026-08-20',
  },
  'boolean-search-operators-for-recruiters': {
    title: 'Boolean Search for Recruiters in 2026: Operators, Query Archetypes, and Debugging',
    description: 'Advanced Boolean search for recruiters: core operators, platform differences, five query archetypes, debugging rules, examples, and evidence-first search design.',
    category: 'Boolean Search',
    updatedAt: '2026-08-20',
  },
  'candidate-360-profile-template': {
    title: 'Candidate 360 Profile Template: Build Evidence-Backed Dossiers Recruiters Can Audit',
    description: 'Separate observed evidence, recruiter-confirmed identity resolution, unknowns, must-have coverage, risk flags, outreach context, and verify-next actions.',
    category: 'Candidate 360',
    updatedAt: '2026-08-20',
  },
  'cleared-devsecops-sourcing': {
    title: 'How to Source Cleared DevSecOps Engineers: Evidence Lanes, GovCon Donor Maps, and Verification Boundaries',
    description: 'A sourcing playbook for cleared platform roles using Kubernetes, Terraform, RMF, ATO, FedRAMP, GovCloud, donor maps, public evidence, and strict clearance boundaries.',
    category: 'GovCon Sourcing',
    updatedAt: '2026-08-20',
  },
  'talent-mapping-donor-companies': {
    title: 'Talent Mapping and Donor Company Strategy: How Sourcers Build Searchable Market Maps',
    description: 'Rank donor companies by work environment, stack, customer, regulation, scale, geography, compensation reality, and talent transferability.',
    category: 'Talent Mapping',
    updatedAt: '2026-08-20',
  },
}

export function withTierAOverride(article: Article): Article {
  const override = tierAArticleOverrides[article.slug]
  return override ? { ...article, ...override } : article
}
