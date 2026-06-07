import { AutoSourceClient } from '@/components/AutoSourceClient'

export const metadata = {
  title: 'AutoSource Agent — Multi-Role Sourcing Command Center',
  description: 'Upload your req load. AutoSource splits each JD into its own sourcing project, builds a role-specific search strategy, captures candidates, learns from your calibration, and tracks a pipeline per role.',
  robots: { index: false, follow: false },
}

export default function AutoSourcePage() {
  return (
    <main className="wrap">
      <div className="eyebrow">SourcingOS Workbench — Private beta</div>
      <AutoSourceClient />
      <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6, marginTop: '32px' }}>
        Local-first: roles and candidates are stored in your browser. Search lanes generate launchable links and manual-safe workflows —
        no scraping, no auto-contact. Clearance and contact signals are never treated as verified. Fit scores are project-specific, not global candidate ratings.
      </p>
    </main>
  )
}
