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
])

const verifiedArticleModified: Record<string, string> = {
  'linkedin-recruiter-alternatives': '2026-08-18',
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
}

const dedicatedArticleRoutes = [
  'where-to-find-cleared-candidates',
  'unique-contribution-rate',
  'senior-sourcer-role-intake',
  'search-exhaustion-framework',
  'boolean-search-benchmark',
  'search-path-scarcity',
  'federal-contract-data-sourcing-lane',
]

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes=['','/candidate-search/','/tools/','/tools/source-stack-coverage/','/tools/search-lane-expander/','/tools/search-exhaustion-calculator/','/tools/unique-contribution-rate-calculator/','/tools/boolean-generator/','/tools/clearance-search/','/tools/aging-req-rescue/','/tools/xray-search/','/tools/jd-search-strategy/','/sources/','/sample-candidate-360/','/methods/','/directory/','/blog/','/playbooks/','/jobs/','/jobs/submit/','/privacy/','/waitlist/','/about/','/methodology/','/training/','/training/ai-sourcing-prompts/','/training/evidence-review-checklist/','/training/hiring-manager-calibration-workshop/','/training/cleared-govcon-sourcing-safety/','/training/candidate-360-workshop/','/trust/','/data-sources/','/terms/','/contact/']
  return [
    ...staticRoutes.map(r=>({url:siteUrl+r})),
    ...dedicatedArticleRoutes.map(slug=>({url:`${siteUrl}/blog/${slug}/`,lastModified:verifiedArticleModified[slug]})),
    ...articles.filter(a=>!redirectedArticleSlugs.has(a.slug)).map(a=>({
      url:`${siteUrl}/blog/${a.slug}/`,
      lastModified:verifiedArticleModified[a.slug] || a.updatedAt || a.publishedAt
    })),
    ...jobs.map(j=>({url:`${siteUrl}/jobs/job/${j.slug}/`}))
  ]
}
