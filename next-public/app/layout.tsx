/* eslint-disable @next/next/no-page-custom-font -- The App Router root layout owns these site-wide font links. */
import type { Metadata } from 'next'
import './globals.css'
import './ui-polish.css'
import './recruiter-results.css'
import './v281-product-truth.css'
import './agentic-role.css'
import { Nav } from '@/components/Nav'
import { PageTracker } from '@/components/PageTracker'
import { siteUrl } from '@/lib/site'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'SourcingOS — Find who your search missed.',
    template: '%s',
  },
  description:
    'Build source packs, run open-web searches, and turn candidate evidence into recruiter-confirmed Candidate 360 profiles. Free sourcing tools for technical, cleared, healthcare, and AI roles.',
  // Do not define a site-wide canonical or Open Graph URL here. Route-level
  // metadata owns page identity so hubs and articles never inherit the homepage URL.
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* DM Sans (body) + Syne (display), loaded once by the root App Router layout. */}
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
          <a href="/trust">Trust</a> · <a href="/methodology">Methodology</a> · <a href="/training">Training</a> · <a href="/data-sources">Data sources</a> ·{' '}
          <a href="/about">About</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/contact">Contact</a>
        </footer>
      </body>
    </html>
  )
}
