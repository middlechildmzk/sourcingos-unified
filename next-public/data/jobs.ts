export type JobCategory = {
  slug: string
  name: string
  description: string
  seoTitle: string
  seoDescription: string
}

export type JobListing = {
  slug: string
  title: string
  company: string
  location: string
  remoteType: 'Remote' | 'Hybrid' | 'Onsite'
  employmentType: 'Full-time' | 'Contract' | 'Fractional' | 'Part-time'
  salaryRange: string
  category: string
  specialty: string[]
  ats: 'Greenhouse' | 'Lever' | 'Ashby' | 'Company Careers' | 'Manual Submission'
  featured?: boolean
  clearanceRequired?: boolean
  healthcareFocus?: boolean
  technicalFocus?: boolean
  sourceUrl: string
  applyUrl: string
  postedDate: string
  expiresAt: string
  summary: string
  description: string[]
  tags: string[]
}

export const jobCategories: JobCategory[] = [
  {
    slug: 'remote-recruiter-jobs',
    name: 'Remote Recruiter Jobs',
    description: 'Remote recruiter roles for full-cycle recruiters, TA partners, and teams that value sourcing discipline.',
    seoTitle: 'Remote Recruiter Jobs (2026) — Live Roles | SourcingOS',
    seoDescription: 'Search current remote recruiter jobs from original public sources. Explore full-cycle recruiter, TA partner, corporate recruiter, and sourcing-heavy remote roles.'
  },
  {
    slug: 'remote-talent-sourcer-jobs',
    name: 'Remote Talent Sourcer Jobs',
    description: 'Remote sourcing roles for people who build outbound pipelines, map markets, and find hard-to-reach talent.',
    seoTitle: 'Remote Talent Sourcer Jobs (2026) — Live Roles | SourcingOS',
    seoDescription: 'Search current remote talent sourcer jobs from original sources, including technical sourcer, sourcing specialist, talent researcher, AI, healthcare, and GovCon roles.'
  },
  {
    slug: 'technical-sourcer-jobs',
    name: 'Technical Sourcer Jobs',
    description: 'Technical sourcing jobs focused on outbound search, passive talent strategy, Boolean, X-Ray, GitHub, and pipeline intelligence.',
    seoTitle: 'Technical Sourcer Jobs (2026) — Live Roles | SourcingOS',
    seoDescription: 'Search current technical sourcer jobs for engineering, AI, cyber, cloud, infrastructure, and hard-to-fill technical hiring. Apply at the original source.'
  },
  {
    slug: 'recruiting-operations-jobs',
    name: 'Recruiting Operations Jobs',
    description: 'Recruiting ops, TA ops, systems, analytics, enablement, and ATS administration roles.',
    seoTitle: 'Recruiting Operations Jobs (2026) — Live TA Ops Roles | SourcingOS',
    seoDescription: 'Search current recruiting operations and TA ops jobs covering recruiting systems, analytics, ATS administration, enablement, automation, and talent operations.'
  },
  {
    slug: 'healthcare-recruiter-jobs',
    name: 'Healthcare Recruiter Jobs',
    description: 'Healthcare recruiting jobs for clinical, nursing, allied health, provider, hospital, and healthcare technology teams.',
    seoTitle: 'Healthcare Recruiter Jobs (2026) — Live Roles | SourcingOS',
    seoDescription: 'Search current healthcare recruiter jobs for nursing, allied health, provider, clinical, hospital, and healthcare technology recruiting from original sources.'
  },
  {
    slug: 'cleared-recruiter-jobs',
    name: 'Cleared / GovCon Recruiter Jobs',
    description: 'Recruiting and sourcing roles supporting cleared, federal, GovCon, defense, cyber, cloud, and mission-focused hiring.',
    seoTitle: 'Cleared & GovCon Recruiter Jobs (2026) | SourcingOS',
    seoDescription: 'Search current cleared recruiter, GovCon recruiter, federal recruiter, and defense sourcing jobs supporting cyber, cloud, technical, and mission hiring.'
  },
  {
    slug: 'ai-recruiter-jobs',
    name: 'AI Recruiter Jobs',
    description: 'Recruiting roles focused on LLM, MLOps, AI infrastructure, applied AI, research, and technical hiring.',
    seoTitle: 'AI Recruiter Jobs (2026) — Live AI & ML Roles | SourcingOS',
    seoDescription: 'Search current AI recruiter and AI sourcer jobs for LLM, MLOps, AI infrastructure, machine learning, applied AI, research, and technical hiring.'
  },
  {
    slug: 'contract-recruiter-jobs',
    name: 'Contract / Fractional Recruiter Jobs',
    description: 'Contract, fractional, embedded, and project-based recruiting and sourcing opportunities.',
    seoTitle: 'Contract Recruiter Jobs (2026) — Remote & Fractional | SourcingOS',
    seoDescription: 'Search current contract recruiter, fractional recruiter, embedded recruiter, and contract sourcer roles from original public job sources.'
  }
]

// Real job cards should come from /api/jobs/search or reviewed employer submissions.
// Do not seed fake companies or example.com apply links in production.
export const jobs: JobListing[] = []

export function getJobBySlug(slug: string) {
  return jobs.find(job => job.slug === slug)
}

export function getCategoryBySlug(slug: string) {
  return jobCategories.find(category => category.slug === slug)
}

export function jobsForCategory(slug: string) {
  return jobs.filter(job => job.category === slug)
}
