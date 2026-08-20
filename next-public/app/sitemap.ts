import type { MetadataRoute } from 'next'
import { articles } from '@/data/articles'
import { jobs } from '@/data/jobs'
import { siteUrl } from '@/lib/site'

const redirectedArticleSlugs = new Set([
  'open-web-sourcing-stack',
  'sourcing-tool-stack-for-agency-recruiters',
  'sourcing-for-founders-and-small-teams',
  'hard-to-fill-role-intake-template',
  'hiring-manager-calibration-questions',
  'govcon-cleared-sourcing-market-map',
  'source-profile-evidence-ledger',
  'contact-enrichment-compliance-for-recruiters',
])

const verifiedArticleModified: Record<string, string> = {
  'linkedin-recruiter-alternatives': '2026-08-18',
  'best-contact-finders-for-recruiters-2026': '2026-08-20',
  'where-to-find-cleared-candidates': '2026-08-15',
  'unique-contribution-rate': '2026-08-19',
  'senior-sourcer-role-intake': '2026-08-15',
  'search-exhaustion-framework': '2026-08-19',
  'boolean-search-benchmark': '2026-08-15',
  'search-path-scarcity': '2026-08-15',
  'federal-contract-data-sourcing-lane': '2026-08-15',
  'ai-sourcing-workflow-2026': '2026-08-19',
  'best-ai-recruiting-tools-for-sourcers-2026': '2026-08-19',
  'sourcing-kpi-dashboard': '2026-08-19',
  'source-pack-methodology': '2026-08-20',
  'github-xray-sourcing': '2026-08-20',
  'how-to-source-ai-ml-engineers': '2026-08-20',
  'boolean-search-operators-for-recruiters': '2026-08-20',
  'candidate-360-profile-template': '2026-08-20',
  'cleared-devsecops-sourcing': '2026-08-20',
  'talent-mapping-donor-companies': '2026-08-20',
}

const dedicatedArticleRoutes = [
  'linkedin-recruiter-alternatives',
  'best-contact-finders-for-recruiters-2026',
  'ai-sourcing-workflow-2026',
  'best-ai-recruiting-tools-for-sourcers-2026',
  'sourcing-kpi-dashboard',
  'where-to-find-cleared-candidates',
  'unique-contribution-rate',
  'senior-sourcer-role-intake',
  'search-exhaustion-framework',
  'boolean-search-benchmark',
  'search-path-scarcity',
  'federal-contract-data-sourcing-lane',
  'source-pack-methodology',
  'github-xray-sourcing',
  'how-to-source-ai-ml-engineers',
  'boolean-search-operators-for-recruiters',
  'candidate-360-profile-template',
  'cleared-devsecops-sourcing',
  'talent-mapping-donor-companies',
]
const dedicatedArticleSlugs = new Set(dedicatedArticleRoutes)

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes=['','/candidate-search/','/tools/','/tools/source-stack-coverage/','/tools/search-lane-expander/','/tools/search-exhaustion-calculator/','/tools/unique-contribution-rate-calculator/','/tools/boolean-generator/','/tools/clearance-search/','/tools/aging-req-rescue/','/tools/xray-search/','/tools/jd-search-strategy/','/sources/','/sample-candidate-360/','/methods/','/directory/','/blog/','/playbooks/','/jobs/','/jobs/submit/','/privacy/','/waitlist/','/about/','/methodology/','/training/','/training/ai-sourcing-prompts/','/training/evidence-review-checklist/','/training/hiring-manager-calibration-workshop/','/training/cleared-govcon-sourcing-safety/','/training/candidate-360-workshop/','/trust/','/data-sources/','/terms/','/contact/']
  return [
    ...staticRoutes.map(r=>({url:siteUrl+r})),
    ...dedicatedArticleRoutes.map(slug=>({url:`${siteUrl}/blog/${slug}/`,lastModified:verifiedArticleModified[slug]})),
    ...articles.filter(a=>!redirectedArticleSlugs.has(a.slug) && !dedicatedArticleSlugs.has(a.slug)).map(a=>({
      url:`${siteUrl}/blog/${a.slug}/`,
      lastModified:verifiedArticleModified[a.slug] || a.updatedAt || a.publishedAt
    })),
    ...jobs.map(j=>({url:`${siteUrl}/jobs/job/${j.slug}/`}))
  ]
}
