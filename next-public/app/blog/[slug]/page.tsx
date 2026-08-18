import { notFound } from 'next/navigation'
import { articles } from '@/data/articles'
import { ArticleBody } from '@/components/ArticleBody'
import { siteUrl } from '@/lib/site'

export function generateStaticParams(){ return articles.map(a => ({ slug: a.slug })) }

export function generateMetadata({ params }: { params: { slug: string } }){
 const article = articles.find(a => a.slug === params.slug); if(!article) return {};
 const articleUrl = `${siteUrl}/blog/${article.slug}/`
 return {
  title: article.title,
  description: article.description,
  keywords: [article.keyword, article.category, 'SourcingOS'],
  alternates: { canonical: articleUrl },
  openGraph: { title: article.title, description: article.description, url: articleUrl, type: 'article', publishedTime: article.publishedAt, modifiedTime: article.updatedAt || article.publishedAt, authors: article.author ? [article.author] : undefined },
  twitter: { card: 'summary_large_image', title: article.title, description: article.description }
 }
}

export default function BlogArticle({ params }: { params: { slug: string } }){
 const article = articles.find(a => a.slug === params.slug); if(!article) return notFound();
 const articleUrl = `${siteUrl}/blog/${article.slug}/`
 const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
   {
    '@type': 'Article',
    '@id': `${articleUrl}#article`,
    headline: article.title,
    description: article.description,
    mainEntityOfPage: { '@id': articleUrl },
    url: articleUrl,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt || article.publishedAt,
    author: article.author ? { '@type': 'Person', name: article.author } : undefined,
    publisher: { '@type': 'Organization', name: 'SourcingOS', url: siteUrl },
    about: [article.category, article.keyword],
   },
   {
    '@type': 'BreadcrumbList',
    '@id': `${articleUrl}#breadcrumbs`,
    itemListElement: [
     { '@type': 'ListItem', position: 1, name: 'SourcingOS', item: `${siteUrl}/` },
     { '@type': 'ListItem', position: 2, name: 'Sourcing Intelligence Blog', item: `${siteUrl}/blog/` },
     { '@type': 'ListItem', position: 3, name: article.title, item: articleUrl },
    ],
   },
   {
    '@type': 'FAQPage',
    '@id': `${articleUrl}#faq`,
    mainEntity: article.faq.map(([question, answer]) => ({
     '@type': 'Question',
     name: question,
     acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
   },
  ],
 }
 return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><ArticleBody article={article}/></>
}
