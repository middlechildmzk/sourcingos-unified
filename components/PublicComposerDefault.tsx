'use client'

import { useEffect } from 'react'

export function PublicComposerDefault() {
  useEffect(() => {
    const openComposer = () => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.wb-tab'))
      const composerButton = buttons.find(button => button.textContent?.includes('Search Composer'))
      composerButton?.click()
    }

    openComposer()
    const timeoutId = window.setTimeout(openComposer, 50)
    return () => window.clearTimeout(timeoutId)
  }, [])

  return (
    <div className="preview-banner" style={{ margin: '0 0 12px', borderColor: 'rgba(72,217,255,.24)' }}>
      <span className="pb-icon">◈</span>
      <span>
        Start with a title, skill, location, clearance breadcrumb, source lane, seniority, company, or certification.
        Enter runs the search from the composer. Saving, contact enrichment, project actions, and Candidate 360 are beta-gated.
      </span>
    </div>
  )
}
