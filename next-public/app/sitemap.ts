import type { MetadataRoute } from 'next'
import { articles } from '@/data/articles'
import { comparisons } from '@/data/comparisons'
import { jobCategories, jobs } from '@/data/jobs'
import { siteUrl } from '@/lib/site'
import { toolRecords } from '@/lib/tool-directory'

const lastModified = new Date('2026-07-04T00:00:00.000Z')

function entry(url: string, priority = 0.6, changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] = 'weekly') {
  return { url, lastModified, priority, changeFrequency }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    ['', 1, 'weekly'],
    ['/candidate-search/', 0.95, 'weekly'],
    ['/tools/', 0.9, 'weekly'],
    ['/tools/search-lane-expander/', 0.86, 'weekly'],
    ['/tools/boolean-generator/', 0.84, 'weekly'],
    ['/tools/clearance-search/', 0.82, 'weekly'],
    ['/tools/aging-req-rescue/', 0.78, 'weekly'],
    ['/tools/xray-search/', 0.82, 'weekly'],
    ['/tools/jd-search-strategy/', 0.84, 'weekly'],
    ['/sources/', 0.72, 'weekly'],
    ['/sample-candidate-360/', 0.78, 'weekly'],
    ['/methods/', 0.75, 'weekly'],
    ['/directory/', 0.86, 'weekly'],
    ['/blog/', 0.78, 'weekly'],
    ['/comparisons/', 0.7, 'weekly'],
    ['/playbooks/', 0.7, 'weekly'],
    ['/jobs/', 0.72, 'daily'],
    ['/jobs/submit/', 0.55, 'monthly'],
    ['/jobs/guides/', 0.68, 'weekly'],
    ['/privacy/', 0.35, 'monthly'],
    ['/waitlist/', 0.82, 'weekly'],
    ['/about/', 0.52, 'monthly'],
    ['/methodology/', 0.86, 'weekly'],
    ['/training/', 0.8, 'weekly'],
    ['/training/ai-sourcing-prompts/', 0.76, 'weekly'],
    ['/training/evidence-review-checklist/', 0.78, 'weekly'],
    ['/training/hiring-manager-calibration-workshop/', 0.74, 'weekly'],
    ['/training/cleared-govcon-sourcing-safety/', 0.76, 'weekly'],
    ['/training/candidate-360-workshop/', 0.76, 'weekly'],
    ['/trust/', 0.84, 'weekly'],
    ['/data-sources/', 0.82, 'weekly'],
    ['/terms/', 0.35, 'monthly'],
    ['/contact/', 0.45, 'monthly'],
  ] as const

  return [
    ...staticRoutes.map(([r, priority, changeFrequency]) => entry(siteUrl + r, priority, changeFrequency)),
    ...toolRecords.map(t => entry(`${siteUrl}/directory/${t.id}/`, 0.58, 'monthly')),
    ...articles.map(a => entry(`${siteUrl}/blog/${a.slug}/`, 0.62, 'monthly')),
    ...comparisons.map(c => entry(`${siteUrl}/comparisons/${c.slug}/`, 0.6, 'monthly')),
    ...jobCategories.map(c => entry(`${siteUrl}/jobs/${c.slug}/`, 0.6, 'daily')),
    ...jobs.map(j => entry(`${siteUrl}/jobs/job/${j.slug}/`, 0.5, 'daily')),
  ]
}
