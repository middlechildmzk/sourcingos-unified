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
    seoTitle: 'Remote Recruiter Jobs | SourcingOS Jobs',
    seoDescription: 'Curated remote recruiter jobs for sourcers, recruiters, TA partners, recruiting ops, and talent leaders.'
  },
  {
    slug: 'remote-talent-sourcer-jobs',
    name: 'Remote Talent Sourcer Jobs',
    description: 'Remote sourcing roles for people who build outbound pipelines, map markets, and find hard-to-reach talent.',
    seoTitle: 'Remote Talent Sourcer Jobs | SourcingOS Jobs',
    seoDescription: 'Curated remote talent sourcer jobs for technical, healthcare, GovCon, AI, and sourcing-heavy recruiting teams.'
  },
  {
    slug: 'technical-sourcer-jobs',
    name: 'Technical Sourcer Jobs',
    description: 'Technical sourcing jobs focused on outbound search, passive talent strategy, Boolean, X-Ray, GitHub, and pipeline intelligence.',
    seoTitle: 'Technical Sourcer Jobs | SourcingOS Jobs',
    seoDescription: 'Find technical sourcer jobs for engineering, AI, cyber, cloud, infrastructure, and hard-to-fill technical roles.'
  },
  {
    slug: 'recruiting-operations-jobs',
    name: 'Recruiting Operations Jobs',
    description: 'Recruiting ops, TA ops, systems, analytics, enablement, and ATS administration roles.',
    seoTitle: 'Recruiting Operations Jobs | SourcingOS Jobs',
    seoDescription: 'Curated recruiting operations jobs for TA ops, systems, analytics, ATS administration, and recruiting enablement.'
  },
  {
    slug: 'healthcare-recruiter-jobs',
    name: 'Healthcare Recruiter Jobs',
    description: 'Healthcare recruiting jobs for clinical, nursing, allied health, provider, hospital, and healthcare technology teams.',
    seoTitle: 'Healthcare Recruiter Jobs | SourcingOS Jobs',
    seoDescription: 'Curated healthcare recruiter jobs for nursing, allied health, provider, clinical, hospital, and healthcare tech recruiting.'
  },
  {
    slug: 'cleared-recruiter-jobs',
    name: 'Cleared / GovCon Recruiter Jobs',
    description: 'Recruiting and sourcing roles supporting cleared, federal, GovCon, defense, cyber, cloud, and mission-focused hiring.',
    seoTitle: 'Cleared Recruiter Jobs | SourcingOS Jobs',
    seoDescription: 'Find cleared recruiter and GovCon sourcing jobs supporting federal, defense, cyber, cloud, and mission hiring.'
  },
  {
    slug: 'ai-recruiter-jobs',
    name: 'AI Recruiter Jobs',
    description: 'Recruiting roles focused on LLM, MLOps, AI infrastructure, applied AI, research, and technical hiring.',
    seoTitle: 'AI Recruiter Jobs | SourcingOS Jobs',
    seoDescription: 'Curated AI recruiter and AI sourcer jobs for LLM, MLOps, AI infrastructure, applied AI, and research hiring.'
  },
  {
    slug: 'contract-recruiter-jobs',
    name: 'Contract / Fractional Recruiter Jobs',
    description: 'Contract, fractional, embedded, and project-based recruiting and sourcing opportunities.',
    seoTitle: 'Contract Recruiter Jobs | SourcingOS Jobs',
    seoDescription: 'Curated contract recruiter and fractional sourcer jobs for remote, embedded, and project-based recruiting work.'
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
