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

    function finishWithMessage(nextMessage: string) {
      url.searchParams.delete('start')
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
      setMessage(nextMessage)
    }

    const interval = window.setInterval(() => {
      ticks += 1
      const shell = document.querySelector('.role-sourcing-execution-v33-4') as HTMLDetailsElement | null

      if (phase === 'search') {
        const button = shell?.querySelector('.agent-review-command-actions button.btn') as HTMLButtonElement | null
        if (button?.disabled && /approve an executable hypothesis/i.test(button.textContent || '')) {
          window.clearInterval(interval)
          finishWithMessage('This search has no executable public source yet. Nothing was silently treated as a zero-result search. Edit the role or open execution details to inspect the source plan.')
          return
        }
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
        } else {
          // When the search button becomes runnable again, the pass has completed.
          // If the slate button is still disabled, there were no eligible records
          // to persist. Surface that truth instead of leaving a permanent spinner.
          const runAgain = shell?.querySelector('.agent-review-command-actions button.btn') as HTMLButtonElement | null
          if (ticks >= 15 && runAgain && !runAgain.disabled && /run sourcing agent/i.test(runAgain.textContent || '') && create?.disabled) {
            window.clearInterval(interval)
            finishWithMessage('Search completed, but this pass returned no eligible public-source records for a review slate. Open execution details to inspect source status or refine the request.')
            return
          }
        }
      }

      // Hard safety timeout. This should be a visible paused state, never an
      // indefinite loading indicator.
      if (phase === 'done' || ticks >= 450) {
        window.clearInterval(interval)
        if (ticks >= 450) {
          finishWithMessage('The initial sourcing pass timed out before a review slate was ready. Open execution details to inspect the source status and retry.')
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
