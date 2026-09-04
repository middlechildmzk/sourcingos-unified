/* eslint-disable @next/next/no-page-custom-font -- The App Router root layout owns these site-wide font links. */
import type { Metadata } from 'next'
import './globals.css'
import './ui-polish.css'
import './recruiter-results.css'
import './v281-product-truth.css'
import './agentic-role.css'
import './home-v31.css'
import './public-v31.css'
import './theme-v31.css'
import './public-v37-1.css'
import './public-mobile-v37-3.css'
import { Nav } from '@/components/Nav'
import { PageTracker } from '@/components/PageTracker'
import { SourcingOSOrganizationJsonLd, SourcingOSWebsiteJsonLd } from '@/components/SiteStructuredData'
import { siteUrl } from '@/lib/site'

const themeBootScript = `(()=>{try{const k='sourcingos.theme';let p=localStorage.getItem(k);if(p!=='light'&&p!=='dark'&&p!=='system')p='system';const r=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;const d=document.documentElement;d.dataset.themePreference=p;d.dataset.theme=r;d.style.colorScheme=r}catch{}})();`

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'SourcingOS — Find who your search missed.',
    template: '%s',
  },
  description:
    'AI-native, recruiter-controlled sourcing for role intake, People Search, multi-source discovery, evidence review, Candidate 360, and talent intelligence.',
  // Do not define a site-wide canonical or Open Graph URL here. Route-level
  // metadata owns page identity so hubs and articles never inherit the homepage URL.
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <SourcingOSOrganizationJsonLd />
        <SourcingOSWebsiteJsonLd />
        {/* Public legacy families remain available; V37.1 recruiter surfaces use Manrope + IBM Plex Mono. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;0,9..40,900;1,9..40,400&family=IBM+Plex+Mono:wght@400;500;600&family=Manrope:wght@400;500;600;700;800&family=Syne:wght@700;800;900&display=swap"
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
