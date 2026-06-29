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
    <p className="muted" style={{ fontSize: '13px', margin: '0 0 12px' }}>
      Start typing a title, skill, clearance, or location. Search Assist will suggest related terms and source lanes.
    </p>
  )
}
