import { DirectoryClient } from '@/components/DirectoryClient'

export const metadata = {
  alternates: { canonical: '/directory/' },
  title: 'Recruiting Tool Directory',
  description: 'Compare sourcing tools, contact finders, AI recruiting tools, ATS/CRM systems, open-web sources, and research-context resources with explicit review notes.',
  openGraph: {
    title: 'Recruiting Tool Directory | SourcingOS',
    description: 'Workflow-first recruiting tool intelligence with explicit pricing review notes and evidence boundaries.',
    url: '/directory/',
    type: 'website',
  },
}

export default function Page(){
  return <main className="wrap"><h1>Recruiting Tool Directory</h1><p className="lead">Workflow-first tool intelligence for sourcers: what each tool is good at, where it fits, and how it connects to a SourcingOS source pack. Research-context resources are separated from direct sourcing platforms instead of inflating the candidate-tool category.</p><DirectoryClient /></main>
}
