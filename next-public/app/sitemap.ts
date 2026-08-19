import type { MetadataRoute } from 'next'
import { articles } from '@/data/articles'
import { comparisons } from '@/data/comparisons'
import { jobCategories, jobs } from '@/data/jobs'
import { siteUrl } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes=['','/candidate-search/','/tools/','/tools/source-stack-coverage/','/tools/search-lane-expander/','/tools/search-exhaustion-calculator/','/tools/unique-contribution-rate-calculator/','/tools/boolean-generator/','/tools/clearance-search/','/tools/aging-req-rescue/','/tools/xray-search/','/tools/jd-search-strategy/','/sources/','/sample-candidate-360/','/methods/','/directory/','/blog/','/blog/where-to-find-cleared-candidates/','/blog/unique-contribution-rate/','/blog/senior-sourcer-role-intake/','/blog/search-exhaustion-framework/','/blog/boolean-search-benchmark/','/blog/search-path-scarcity/','/blog/federal-contract-data-sourcing-lane/','/comparisons/','/playbooks/','/jobs/','/jobs/submit/','/jobs/guides/','/privacy/','/waitlist/','/about/','/methodology/','/training/','/training/ai-sourcing-prompts/','/training/evidence-review-checklist/','/training/hiring-manager-calibration-workshop/','/training/cleared-govcon-sourcing-safety/','/training/candidate-360-workshop/','/trust/','/data-sources/','/terms/','/contact/']
  return [
    ...staticRoutes.map(r=>({url:siteUrl+r})),
    ...articles.map(a=>({
      url:`${siteUrl}/blog/${a.slug}/`,
      lastModified:a.slug === 'linkedin-recruiter-alternatives' ? '2026-08-18' : (a.updatedAt || a.publishedAt)
    })),
    ...comparisons.map(c=>({url:`${siteUrl}/comparisons/${c.slug}/`})),
    ...jobCategories.map(c=>({url:`${siteUrl}/jobs/${c.slug}/`})),
    ...jobs.map(j=>({url:`${siteUrl}/jobs/job/${j.slug}/`}))
  ]
}
