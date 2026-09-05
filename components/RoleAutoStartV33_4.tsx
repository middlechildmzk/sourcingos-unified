'use client'

import { useEffect, useState } from 'react'

type Progress = {
  phase: 'starting' | 'searching' | 'reviewing' | 'saving' | 'ready' | 'paused'
  message: string
  current: number
  total: number
}

/**
 * The recruiter's Start sourcing click is the explicit authorization for the
 * initial research pass and creation of an unreviewed review slate. This client
 * bridge reuses the existing canonical agent and persistence buttons rather than
 * adding a second execution path. It never authorizes shortlist/reject/outreach.
 */
export function RoleAutoStartV33_4({ roleId }: { roleId: string }) {
  const [progress, setProgress] = useState<Progress | null>(null)

  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('start') !== '1') return

    let phase: 'search' | 'slate' | 'persisting' | 'done' = 'search'
    let ticks = 0
    setProgress({ phase: 'starting', message: 'Understanding the approved search and starting the sourcing agent…', current: 0, total: 0 })

    function onProgress(event: Event) {
      const detail = (event as CustomEvent<{ roleId?: string; phase?: Progress['phase']; message?: string; current?: number; total?: number }>).detail
      if (!detail || detail.roleId !== roleId || !detail.phase || !detail.message) return
      setProgress({ phase: detail.phase, message: detail.message, current: detail.current || 0, total: detail.total || 0 })
      if (detail.phase === 'ready' || detail.phase === 'paused') {
        phase = 'done'
        url.searchParams.delete('start')
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
        window.setTimeout(() => setProgress(null), detail.phase === 'ready' ? 8000 : 15000)
      }
    }
    window.addEventListener('sourcingos:role-search-progress', onProgress)

    function finishWithMessage(nextMessage: string) {
      url.searchParams.delete('start')
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
      setProgress({ phase: 'paused', message: nextMessage, current: 0, total: 0 })
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
          setProgress({ phase: 'searching', message: 'Sourcing across the approved search angles…', current: 0, total: 0 })
        }
      } else if (phase === 'slate') {
        const create = shell?.querySelector('.agent-review-create-bar button.btn') as HTMLButtonElement | null
        if (create && !create.disabled && /create review slate/i.test(create.textContent || '')) {
          create.click()
          phase = 'persisting'
          setProgress({ phase: 'saving', message: 'Building your first evidence-bearing review batch…', current: 0, total: 0 })
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
        }
      }
    }, 400)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('sourcingos:role-search-progress', onProgress)
    }
  }, [roleId])

  if (!progress) return null
  const percent = progress.total ? Math.round((progress.current / progress.total) * 100) : 12
  return <div className={`role-autostart-v33-4 phase-${progress.phase}`} role="status" aria-live="polite">
    <div className="role-autostart-icon-v33-9"><span className="role-autostart-pulse-v33-4" /></div>
    <div className="role-autostart-copy-v33-9">
      <b>{progress.phase === 'ready' ? 'Your first batch is ready' : progress.phase === 'paused' ? 'Search needs attention' : 'SourcingOS is working'}</b>
      <span>{progress.message}</span>
      {progress.phase !== 'ready' && progress.phase !== 'paused' && <div className="role-autostart-meter-v33-9"><i style={{ width: `${Math.max(8, percent)}%` }} /></div>}
    </div>
    <em>{progress.current && progress.total ? `${progress.current}/${progress.total}` : progress.phase === 'ready' ? 'Ready to review' : 'Working'}</em>
  </div>
}
