import { DirectoryClient } from '@/components/DirectoryClient'
export const metadata = { alternates: { canonical: '/directory/' }, title: 'Recruiting Tool Directory', description: 'Compare sourcing tools, contact finders, AI recruiting tools, ATS/CRM systems, and open-web sources.' }
export default function Page(){ return <main className="wrap"><h1>Recruiting Tool Directory</h1><p className="lead">Workflow-first tool intelligence for sourcers: what each tool is good at, where it fits, and how it connects to a SourcingOS source pack.</p><DirectoryClient /></main> }
