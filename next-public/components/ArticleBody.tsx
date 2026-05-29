import Link from 'next/link'
import type { Article } from '@/data/articles'
export function ArticleBody({ article }: { article: Article }){
 return <main className="wrap article"><span className="kicker">{article.category}</span><h1>{article.title}</h1><p className="lead">{article.description}</p><div className="cta"><strong>Primary next action:</strong> <Link href={article.tool}>{article.cta}</Link></div>{article.sections.map(([h,b])=><section key={h}><h2>{h}</h2><p>{b}</p></section>)}<section><h2>Copy-paste starting strings</h2>{article.strings.map(s=><pre key={s}>{s}</pre>)}</section><section><h2>Operating notes</h2><ul>{article.bullets.map(b=><li key={b}>{b}</li>)}</ul></section><section><h2>FAQ</h2>{article.faq.map(([q,a])=><div className="faq" key={q}><h3>{q}</h3><p>{a}</p></div>)}</section><div className="cta"><strong>Use this in SourcingOS:</strong> <Link href={article.tool}>{article.cta}</Link></div></main>
}
