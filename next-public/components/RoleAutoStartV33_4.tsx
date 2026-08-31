'use client'

import { useEffect, useState } from 'react'

/**
 * The recruiter's Start sourcing click is the explicit authorization for the
 * initial research pass and creation of an unreviewed review slate. This client
 * bridge reuses the existing canonical agent and persistence buttons rather than
 * adding a second execution path. It never authorizes shortlist/reject/outreach.
 */
export function RoleAutoStartV33_4({ roleId }: { roleId: string }) {
  const [message, setMessage] = useState('')

  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('start') !== '1') return

    let phase: 'search' | 'slate' | 'done' = 'search'
    let ticks = 0
    setMessage('Starting the sourcing agent…')

    const interval = window.setInterval(() => {
      ticks += 1
      const shell = document.querySelector('.role-sourcing-execution-v33-4') as HTMLDetailsElement | null

      if (phase === 'search') {
        const button = shell?.querySelector('.agent-review-command-actions button.btn') as HTMLButtonElement | null
        if (button && !button.disabled && /run sourcing agent/i.test(button.textContent || '')) {
          button.click()
          phase = 'slate'
          setMessage('Sourcing across the approved search angles…')
        }
      } else if (phase === 'slate') {
        const create = shell?.querySelector('.agent-review-create-bar button.btn') as HTMLButtonElement | null
        if (create && !create.disabled && /create review slate/i.test(create.textContent || '')) {
          create.click()
          phase = 'done'
          setMessage('Building your unreviewed review slate…')
          url.searchParams.delete('start')
          window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
        }
      }

      // Do not loop forever if a source returns no eligible records or is slow.
      // The detailed agent remains available on demand while the primary
      // workbench shows live lane progress and candidate state.
      if (phase === 'done' || ticks >= 450) {
        window.clearInterval(interval)
        if (ticks >= 450) {
          url.searchParams.delete('start')
          window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
          setMessage('Initial pass completed or paused without an automatic candidate decision. Open execution details only if you need to inspect it.')
        } else {
          window.setTimeout(() => setMessage(''), 3500)
        }
      }
    }, 400)

    return () => window.clearInterval(interval)
  }, [roleId])

  if (!message) return null
  return <div className="role-autostart-v33-4" role="status"><span className="role-autostart-pulse-v33-4" />{message}</div>
}
