import type { Metadata } from 'next'
import './globals.css'
import { Nav } from '@/components/Nav'
import { PageTracker } from '@/components/PageTracker'

export const metadata: Metadata = {
  metadataBase: new URL('https://sourcingos.com'),
  title: { default: 'SourcingOS — Find who your search missed', template: '%s | SourcingOS' },
  description: 'Free sourcing tools, source packs, X-Ray search, Boolean strings, recruiting tool intelligence, and private beta access for hard-to-fill roles.',
  openGraph: { title: 'SourcingOS', description: 'Find who your search missed.', type: 'website' }
}
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body><PageTracker/><Nav />{children}<footer className="footer">SourcingOS Vault + private beta cockpit. Human-approved sourcing intelligence, not autonomous recruiting.</footer></body></html> }
