import type { Metadata } from 'next'
import './globals.css'
import './ui-polish.css'
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
  // NOTE: no site-wide alternates.canonical here. A root-layout canonical of '/'
  // is inherited by every page that does not override it, which told search
  // engines the whole site was a duplicate of the homepage. Pages set their own.
  openGraph: {
    title: 'SourcingOS — Find who your search missed.',
    description:
      'Human-approved sourcing intelligence for hard-to-fill technical, cleared, healthcare, and AI roles. No silent merges. No fake verification.',
    type: 'website',
    url: siteUrl,
    siteName: 'SourcingOS',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'SourcingOS — Find who your search missed.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SourcingOS — Find who your search missed.',
    description:
      'Human-approved sourcing intelligence for hard-to-fill technical, cleared, healthcare, and AI roles.',
    images: ['/opengraph-image'],
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
          <a href="/trust">Trust</a> · <a href="/methodology">Methodology</a> · <a href="/training">Training</a> · <a href="/data-sources">Data sources</a> ·{' '}
          <a href="/about">About</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/contact">Contact</a>
        </footer>
      </body>
    </html>
  )
}
