import type { Article } from '@/data/articles'

type ArticleOverride = Pick<Article, 'title' | 'description' | 'category'> & { updatedAt: string }

export const tierAArticleOverrides: Record<string, ArticleOverride> = {
  'best-ai-recruiting-tools-for-sourcers-2026': {
    title: 'AI Recruiting Tools for Sourcers in 2026: 4 Platforms to Benchmark Before You Buy',
    description: 'Compare LinkedIn Recruiter, hireEZ, SeekOut, and Juicebox with one sourcing-specific buyer test for evidence-fit discovery, unique contribution, recruiter control, workflow overlap, and automation risk.',
    category: 'AI Recruiting Tools',
    updatedAt: '2026-08-20',
  },
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
  'technical-sourcer-operating-system': {
    title: 'Technical Sourcer Operating System: The Weekly Workflow for Hard-to-Fill Searches',
    description: 'A weekly system for req triage, source packs, search experiments, hiring-manager calibration, evidence review, rediscovery, and project memory.',
    category: 'Sourcer Workflow',
    updatedAt: '2026-08-20',
  },
  'cybersecurity-boolean-strings': {
    title: '30 Boolean Search Strings for Cybersecurity Recruiters: Role-Specific Queries for 2026',
    description: 'Thirty recruiter-ready cybersecurity Boolean strings for RMF, SOC, AppSec, cloud security, IAM, DFIR, security engineering, offensive security, GRC, and cleared cyber.',
    category: 'Cybersecurity Recruiting',
    updatedAt: '2026-08-20',
  },
  'recruiter-ai-prompts-source-pack': {
    title: '15 AI Prompts for Recruiters: Source Packs, Boolean Search, Talent Maps, and Evidence Review',
    description: 'Fifteen recruiter-safe prompts for intake, title expansion, lanes, Boolean critique, donor mapping, evidence review, no-results rescue, calibration, and retrospectives.',
    category: 'AI Prompts',
    updatedAt: '2026-08-20',
  },
  'healthcare-recruiting-open-web': {
    title: 'Healthcare Recruiting Open-Web Sourcing: Licenses, NPI Data, Local Markets, and Healthcare IT Evidence',
    description: 'Separate clinical licensure, NPI/provider data, local-market evidence, healthcare IT systems, and recruiter-confirmed role evidence into distinct sourcing lanes.',
    category: 'Healthcare Recruiting',
    updatedAt: '2026-08-20',
  },
  'aging-req-rescue-framework': {
    title: 'Aging Req Rescue Framework: Diagnose Why a Hard-to-Fill Search Is Stuck',
    description: 'Distinguish no leads, wrong leads, no response, HM rejection, compensation/location mismatch, and process fallout before choosing the next search experiment.',
    category: 'Req Rescue',
    updatedAt: '2026-08-20',
  },
  'ats-rediscovery-sourcing': {
    title: 'ATS Rediscovery Sourcing: Turn Past Candidates and Recruiting History Into a New Search Lane',
    description: 'A rediscovery framework for prior finalists, silver medalists, past applicants, referrals, rejection reasons, stale-context checks, opt-outs, and search-pattern learning.',
    category: 'Rediscovery',
    updatedAt: '2026-08-20',
  },
}

export function withTierAOverride(article: Article): Article {
  const override = tierAArticleOverrides[article.slug]
  return override ? { ...article, ...override } : article
}
