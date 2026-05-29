import type { Metadata } from 'next'
import './globals.css'
import { Nav } from '@/components/Nav'
import { PageTracker } from '@/components/PageTracker'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://sourcingos-unified.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'SourcingOS — The sourcing stack for hard-to-fill roles', template: '%s | SourcingOS' },
  description: 'Source packs, Boolean strings, X-Ray searches, and recruiter-confirmed candidate evidence for hard-to-fill technical, cleared, cyber, healthcare, and AI roles.',
  openGraph: {
    title: 'SourcingOS — The sourcing stack for hard-to-fill roles',
    description: 'Free sourcing tools and a private Candidate Graph beta for senior sourcers.',
    type: 'website',
    url: siteUrl
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SourcingOS — The sourcing stack for hard-to-fill roles',
    description: 'Free sourcing tools and a private Candidate Graph beta for senior sourcers.'
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><PageTracker/><Nav />{children}<footer className="footer">Human-approved sourcing intelligence, not autonomous recruiting. Public evidence, recruiter confirmation, and no silent profile merges.</footer></body></html>
}
