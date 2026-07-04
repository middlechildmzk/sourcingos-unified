import type { MetadataRoute } from 'next'
import { articles } from '@/data/articles'
import { comparisons } from '@/data/comparisons'
import { jobCategories, jobs } from '@/data/jobs'
import { siteUrl } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes=['','/candidate-search/','/tools/','/tools/boolean-generator/','/tools/clearance-search/','/tools/aging-req-rescue/','/tools/xray-search/','/tools/jd-search-strategy/','/sources/','/sample-candidate-360/','/methods/','/directory/','/blog/','/comparisons/','/playbooks/','/jobs/','/jobs/submit/','/jobs/guides/','/privacy/','/waitlist/','/about/','/methodology/','/trust/','/data-sources/','/terms/','/contact/']
  return [
    ...staticRoutes.map(r=>({url:siteUrl+r,lastModified:new Date()})),
    ...articles.map(a=>({url:`${siteUrl}/blog/${a.slug}/`,lastModified:new Date()})),
    ...comparisons.map(c=>({url:`${siteUrl}/comparisons/${c.slug}/`,lastModified:new Date()})),
    ...jobCategories.map(c=>({url:`${siteUrl}/jobs/${c.slug}/`,lastModified:new Date()})),
    ...jobs.map(j=>({url:`${siteUrl}/jobs/job/${j.slug}/`,lastModified:new Date()}))
  ]
}
