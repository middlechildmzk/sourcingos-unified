import { notFound } from 'next/navigation'
import { articles } from '@/data/articles'
import { ArticleBody } from '@/components/ArticleBody'
export function generateStaticParams(){ return articles.map(a => ({ slug: a.slug })) }
export function generateMetadata({ params }: { params: { slug: string } }){
 const article = articles.find(a => a.slug === params.slug); if(!article) return {};
 return {
  title: article.title,
  description: article.description,
  keywords: [article.keyword, article.category, 'SourcingOS'],
  alternates: { canonical: `/blog/${article.slug}` },
  openGraph: { title: article.title, description: article.description, url: `/blog/${article.slug}` },
  twitter: { title: article.title, description: article.description }
 }
}
export default function BlogArticle({ params }: { params: { slug: string } }){ const article = articles.find(a => a.slug === params.slug); if(!article) return notFound(); return <ArticleBody article={article}/> }
