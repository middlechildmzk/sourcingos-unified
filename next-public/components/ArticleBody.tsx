import Link from 'next/link'
import type { Article } from '@/data/articles'

export function ArticleBody({ article }: { article: Article }){
 const primarySections = article.sections.slice(0, 2)
 const remainingSections = article.sections.slice(2)
 return <main className="wrap article article-pro">
  <div className="article-hero-card">
   <span className="kicker">{article.category}</span>
   <h1>{article.title}</h1>
   {(article.author || article.publishedAt) && <p className="muted" style={{ fontSize: 13, margin: '4px 0 12px' }}>{article.author}{article.author && article.publishedAt ? ' · ' : ''}{article.publishedAt && <>Published {new Date(article.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</>}{article.updatedAt && <> · Updated {new Date(article.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</>}</p>}
   <p className="lead">{article.description}</p>
   <div className="article-meta-grid">
    <div><span>Primary keyword</span><strong>{article.keyword}</strong></div>
    <div><span>Next action</span><Link href={article.tool}>{article.cta}</Link></div>
    <div><span>SourcingOS rule</span><strong>Evidence first, recruiter confirmed</strong></div>
   </div>
  </div>

  <div className="article-layout">
   <aside className="article-sidebar">
    <div className="mini-card"><span className="kicker">In this guide</span>{article.sections.map(([h])=><a key={h} href={`#${h.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`}>{h}</a>)}</div>
    <div className="mini-card"><span className="kicker">Trust note</span><p>Public evidence is not verification. Contact signals, clearance breadcrumbs, and open-to-work language require recruiter confirmation.</p></div>
   </aside>
   <article className="article-main">
    {primarySections.map(([h,b])=><section key={h} id={h.toLowerCase().replace(/[^a-z0-9]+/g,'-')}><h2>{h}</h2><p>{b}</p></section>)}
    <section className="article-callout"><h2>Operating notes</h2><ul>{article.bullets.map(b=><li key={b}>{b}</li>)}</ul></section>
    {remainingSections.map(([h,b])=><section key={h} id={h.toLowerCase().replace(/[^a-z0-9]+/g,'-')}><h2>{h}</h2><p>{b}</p></section>)}
    <section><h2>Copy-paste starting strings</h2>{article.strings.map(s=><pre key={s}>{s}</pre>)}</section>
    <section><h2>FAQ</h2>{article.faq.map(([q,a])=><div className="faq" key={q}><h3>{q}</h3><p>{a}</p></div>)}</section>
    <div className="cta"><strong>Use this in SourcingOS:</strong> <Link href={article.tool}>{article.cta}</Link></div>
   </article>
  </div>
 </main>
}
