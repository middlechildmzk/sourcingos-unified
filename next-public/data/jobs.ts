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

export const jobs: JobListing[] = [
  {
    slug: 'senior-technical-sourcer-ai-infrastructure',
    title: 'Senior Technical Sourcer, AI Infrastructure',
    company: 'Nova Labs AI',
    location: 'Remote, United States',
    remoteType: 'Remote',
    employmentType: 'Full-time',
    salaryRange: '$135k-$175k',
    category: 'technical-sourcer-jobs',
    specialty: ['AI/ML', 'Infrastructure', 'Technical Sourcing'],
    ats: 'Ashby',
    featured: true,
    technicalFocus: true,
    sourceUrl: 'https://example.com/nova-labs-ai-careers',
    applyUrl: 'https://example.com/nova-labs-ai-careers/senior-technical-sourcer-ai-infrastructure',
    postedDate: '2026-05-29',
    expiresAt: '2026-07-29',
    summary: 'Own outbound sourcing for AI infrastructure, ML platform, distributed systems, and cloud engineering roles.',
    description: [
      'Build high-signal outbound pipelines for AI infrastructure, distributed systems, cloud, and ML platform roles.',
      'Partner with hiring managers on role calibration, market mapping, search lanes, and outreach strategy.',
      'Use GitHub, open-web search, technical communities, and sourcing tools to identify passive technical talent.'
    ],
    tags: ['AI/ML', 'Infrastructure', 'Sourcing-heavy', 'Ashby']
  },
  {
    slug: 'remote-talent-sourcer-federal-technology',
    title: 'Remote Talent Sourcer, Federal Technology',
    company: 'Civic Cloud Systems',
    location: 'Remote, United States',
    remoteType: 'Remote',
    employmentType: 'Contract',
    salaryRange: '$70-$95/hr',
    category: 'cleared-recruiter-jobs',
    specialty: ['GovCon', 'Cloud', 'Cybersecurity'],
    ats: 'Greenhouse',
    featured: true,
    clearanceRequired: true,
    technicalFocus: true,
    sourceUrl: 'https://example.com/civic-cloud-careers',
    applyUrl: 'https://example.com/civic-cloud-careers/remote-talent-sourcer-federal-technology',
    postedDate: '2026-05-29',
    expiresAt: '2026-07-29',
    summary: 'Contract sourcer supporting cloud, cybersecurity, DevSecOps, and federal technology pipelines.',
    description: [
      'Support hard-to-fill federal technology searches across cloud, cyber, DevSecOps, and infrastructure.',
      'Build GovCon donor-company maps and sourcing lanes for cleared and clearance-adjacent talent.',
      'Use careful language around public clearance breadcrumbs and recruiter-confirmed verification.'
    ],
    tags: ['GovCon', 'Federal', 'Cloud', 'Cleared']
  },
  {
    slug: 'recruiting-operations-specialist',
    title: 'Recruiting Operations Specialist',
    company: 'PipelineOps',
    location: 'Remote, US or Canada',
    remoteType: 'Remote',
    employmentType: 'Full-time',
    salaryRange: '$90k-$125k',
    category: 'recruiting-operations-jobs',
    specialty: ['Recruiting Ops', 'ATS', 'Analytics'],
    ats: 'Lever',
    sourceUrl: 'https://example.com/pipelineops-careers',
    applyUrl: 'https://example.com/pipelineops-careers/recruiting-operations-specialist',
    postedDate: '2026-05-29',
    expiresAt: '2026-07-29',
    summary: 'Maintain recruiting systems, reporting, workflows, and interview operations for a fast-growing talent team.',
    description: [
      'Own ATS hygiene, reporting, interview workflows, automation, and recruiter enablement.',
      'Partner with TA leaders on funnel metrics, source attribution, and operational improvements.',
      'Support a recruiting stack including ATS, CRM, scheduling, analytics, and sourcing tools.'
    ],
    tags: ['Recruiting Ops', 'ATS', 'Reporting']
  },
  {
    slug: 'ai-recruiting-partner',
    title: 'AI Recruiting Partner',
    company: 'VectorWorks AI',
    location: 'New York or Remote US',
    remoteType: 'Hybrid',
    employmentType: 'Full-time',
    salaryRange: '$145k-$190k',
    category: 'ai-recruiter-jobs',
    specialty: ['AI/ML', 'LLM', 'MLOps'],
    ats: 'Ashby',
    featured: true,
    technicalFocus: true,
    sourceUrl: 'https://example.com/vectorworks-ai-careers',
    applyUrl: 'https://example.com/vectorworks-ai-careers/ai-recruiting-partner',
    postedDate: '2026-05-29',
    expiresAt: '2026-07-29',
    summary: 'Partner with founders and engineering leaders to hire LLM, MLOps, product engineering, and research talent.',
    description: [
      'Lead recruiting strategy for LLM, MLOps, AI infra, applied AI, and research hiring.',
      'Develop source packs across GitHub, OpenAlex, Hugging Face, technical communities, and referrals.',
      'Translate ambiguous AI hiring needs into realistic market maps and hiring manager tradeoffs.'
    ],
    tags: ['LLM', 'MLOps', 'Startup']
  },
  {
    slug: 'healthcare-recruiter-nursing-allied-health',
    title: 'Healthcare Recruiter, Nursing & Allied Health',
    company: 'NorthStar Care Network',
    location: 'Remote, Midwest preferred',
    remoteType: 'Remote',
    employmentType: 'Full-time',
    salaryRange: '$80k-$115k',
    category: 'healthcare-recruiter-jobs',
    specialty: ['Nursing', 'Allied Health', 'Healthcare'],
    ats: 'Company Careers',
    healthcareFocus: true,
    sourceUrl: 'https://example.com/northstar-care-careers',
    applyUrl: 'https://example.com/northstar-care-careers/healthcare-recruiter-nursing-allied-health',
    postedDate: '2026-05-29',
    expiresAt: '2026-07-29',
    summary: 'Recruit nurses and allied health professionals across hospital, clinic, and home health settings.',
    description: [
      'Source and engage nurses, allied health professionals, and clinical talent across thin local markets.',
      'Build specialty-specific pipelines for ICU, OR, L&D, home health, and therapy roles.',
      'Use ethical healthcare sourcing practices and avoid treating public registries as outreach permission.'
    ],
    tags: ['Nursing', 'Allied Health', 'Remote']
  },
  {
    slug: 'fractional-technical-recruiter-b2b-saas',
    title: 'Fractional Technical Recruiter, B2B SaaS',
    company: 'Foundry Talent Collective',
    location: 'Remote, United States',
    remoteType: 'Remote',
    employmentType: 'Fractional',
    salaryRange: '$85-$120/hr',
    category: 'contract-recruiter-jobs',
    specialty: ['Technical Recruiting', 'Startup', 'Fractional'],
    ats: 'Manual Submission',
    technicalFocus: true,
    sourceUrl: 'https://example.com/foundry-talent-collective',
    applyUrl: 'https://example.com/foundry-talent-collective/fractional-technical-recruiter-b2b-saas',
    postedDate: '2026-05-29',
    expiresAt: '2026-07-29',
    summary: 'Fractional recruiter supporting founder-led B2B SaaS teams with engineering and GTM hiring.',
    description: [
      'Run full-cycle and sourcing-heavy hiring for early-stage B2B SaaS clients.',
      'Build repeatable sourcing systems, candidate pipelines, outreach, and reporting for founders.',
      'Ideal for a recruiter with strong outbound sourcing habits and comfort working across several clients.'
    ],
    tags: ['Fractional', 'Startup', 'Remote']
  }
]

export function getJobBySlug(slug: string) {
  return jobs.find(job => job.slug === slug)
}

export function getCategoryBySlug(slug: string) {
  return jobCategories.find(category => category.slug === slug)
}

export function jobsForCategory(slug: string) {
  return jobs.filter(job => job.category === slug)
}
