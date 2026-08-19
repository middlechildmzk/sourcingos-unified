import Link from 'next/link'
import { notFound } from 'next/navigation'
import { comparisons } from '@/data/comparisons'

export function generateStaticParams(){ return comparisons.map(c=>({slug:c.slug})) }

export function generateMetadata({params}:{params:{slug:string}}){
  const c=comparisons.find(x=>x.slug===params.slug)
  return c?{
    title:c.title,
    description:c.description,
    alternates:{canonical:`/comparisons/${c.slug}/`},
    robots:{index:false,follow:true},
    openGraph:{title:c.title,description:c.description,url:`/comparisons/${c.slug}/`,type:'website'}
  }:{}
}

export default function Page({params}:{params:{slug:string}}){
  const c=comparisons.find(x=>x.slug===params.slug)
  if(!c)return notFound()
  return <main className="wrap article"><span className="kicker">Comparison topic · research not yet published</span><h1>{c.title}</h1><p className="lead">{c.description}</p><div className="article-callout"><h2>Editorial status</h2><p>This route is not presented as a completed vendor comparison yet. The current page does not contain the hands-on testing, dated vendor facts, pricing verification, or evidence needed for a search-facing buyer guide.</p></div><h2>How SourcingOS will evaluate it</h2><p>Compare tools by the sourcing job they perform, the evidence they expose, unique contribution against the existing stack, recruiter control, workflow cost, and current verified product facts. Do not treat a generic feature list as a benchmark.</p><h2>Use the published resources now</h2><p><Link href="/directory/">Browse the recruiting tool directory</Link> and use the <Link href="/blog/ai-sourcing-workflow-2026/">8-task AI sourcing evaluation harness</Link> for a repeatable test you can run today.</p></main>
}
