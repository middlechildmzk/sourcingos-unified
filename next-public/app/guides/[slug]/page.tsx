import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FaqJsonLd } from '@/components/StructuredData'
import { authorityPages } from '@/data/authority-pages'

export function generateStaticParams() {
  return authorityPages.map(page => ({ slug: page.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const page = authorityPages.find(item => item.slug === params.slug)
  if (!page) return {}
  return {
    alternates: { canonical: `/guides/${page.slug}/` },
    title: `${page.title} | SourcingOS`,
    description: page.description,
    keywords: [page.intent, page.format, 'SourcingOS'],
  }
}

export default function GuideDetailPage({ params }: { params: { slug: string } }) {
  const page = authorityPages.find(item => item.slug === params.slug)
  if (!page) notFound()

  return <main className="wrap article">
    <FaqJsonLd id={`${page.slug}-faq-jsonld`} faqs={page.faqs.map(faq => ({ question: faq.question, answer: faq.answer }))} />
    <span className="kicker">{page.format} · {page.intent}</span>
    <h1>{page.title}</h1>
    <p className="lead">{page.description}</p>

    <div className="article-callout">
      <strong>TL;DR:</strong> {page.sections[0]?.body}
    </div>

    {page.sections.map(section => <section key={section.heading}>
      <h2>{section.heading}</h2>
      <p>{section.body}</p>
    </section>)}

    <section>
      <h2>Checklist</h2>
      <ul>{page.bullets.map(bullet => <li key={bullet}>{bullet}</li>)}</ul>
    </section>

    <section>
      <h2>FAQ</h2>
      {page.faqs.map(faq => <div className="faq" key={faq.question}>
        <h3>{faq.question}</h3>
        <p>{faq.answer}</p>
      </div>)}
    </section>

    <section>
      <h2>Next step</h2>
      <p>
        <Link className="btn" href={page.ctaHref}>{page.ctaLabel}</Link>{' '}
        <Link className="btn secondary" href="/guides">Back to guides</Link>
      </p>
    </section>
  </main>
}
