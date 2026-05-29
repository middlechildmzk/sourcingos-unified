import type { MetadataRoute } from 'next'
import { articles } from '@/data/articles'
import { comparisons } from '@/data/comparisons'
const base='https://sourcingos.com'
export default function sitemap(): MetadataRoute.Sitemap { const staticRoutes=['','/tools','/tools/boolean-generator','/tools/xray-search','/tools/jd-search-strategy','/sources','/app/candidate-graph','/methods','/directory','/blog','/comparisons','/playbooks','/waitlist']; return [...staticRoutes.map(r=>({url:base+r,lastModified:new Date()})), ...articles.map(a=>({url:`${base}/blog/${a.slug}`,lastModified:new Date()})), ...comparisons.map(c=>({url:`${base}/comparisons/${c.slug}`,lastModified:new Date()}))] }
