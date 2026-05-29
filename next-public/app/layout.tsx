import type { Metadata } from 'next'
import './globals.css'
import { Nav } from '@/components/Nav'
import { PageTracker } from '@/components/PageTracker'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://sourcingos-unified.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'SourcingOS — Find who your search missed.',
    template: '%s | SourcingOS',
  },
  description:
    'Build source packs, run open-web searches, and turn candidate evidence into recruiter-confirmed Candidate 360 profiles. Free sourcing tools for technical, cleared, healthcare, and AI roles.',
  openGraph: {
    title: 'SourcingOS — Find who your search missed.',
    description:
      'Free sourcing tools and private Candidate Search beta for senior sourcers.',
    type: 'website',
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SourcingOS — Find who your search missed.',
    description:
      'Free sourcing tools and private Candidate Search beta for senior sourcers.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* DM Sans (body) + Syne (display) — distinctive, technical, professional */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;0,9..40,900;1,9..40,400&family=Syne:wght@700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <PageTracker />
        <Nav />
        {children}
        <footer className="footer">
          Human-approved sourcing intelligence. Public evidence, recruiter confirmation, no silent profile merges.{' '}
          <a href="/privacy">Privacy</a>
        </footer>
      </body>
    </html>
  )
}
