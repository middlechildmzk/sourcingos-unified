import fs from 'node:fs'

const path = 'next-public/components/CandidateDrawer.tsx'
let text = fs.readFileSync(path, 'utf8')

function replaceOnce(search, replacement, label) {
  if (!text.includes(search)) {
    if (text.includes(replacement)) return
    throw new Error(`Missing drawer transform marker: ${label}`)
  }
  text = text.replace(search, replacement)
}

replaceOnce(
  "import { useState } from 'react'",
  "import { useEffect, useId, useRef, useState } from 'react'",
  'React accessibility hooks',
)

replaceOnce(
  "import type { SourceResult } from '@/lib/source-types'",
  "import type { SourceResult } from '@/lib/source-types'\nimport { canPromoteToCandidate, entityKindLabels } from '@/lib/entity-classification'",
  'entity classification import',
)

replaceOnce(
  "  const [localSaved, setLocalSaved] = useState<DrawerSavedState | null>(saved ?? null)\n\n  if (!result) return null",
  `  const [localSaved, setLocalSaved] = useState<DrawerSavedState | null>(saved ?? null)
  const dialogRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus())
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      )).filter(element => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true')
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [open, onClose])

  if (!result || !open) return null`,
  'drawer modal lifecycle',
)

replaceOnce(
  "  const isSaved = Boolean(localSaved)",
  "  const isSaved = Boolean(localSaved)\n  const entityKind = result.entityKind ?? 'unknown'\n  const canSaveCandidate = canPromoteToCandidate(entityKind)",
  'candidate save eligibility',
)

replaceOnce(
  "  async function saveSourceProfile() {\n    if (!result) return",
  "  async function saveSourceProfile() {\n    if (!result) return\n    if (!canSaveCandidate) {\n      setNotice(`${entityKindLabels[entityKind]} records cannot be saved as candidates.`)\n      return\n    }",
  'save guard',
)

replaceOnce(
  '<aside className={`candidate-drawer ${open ? \'candidate-drawer-open\' : \'\'}`} role="dialog" aria-label="Candidate source profile">',
  '<aside ref={dialogRef} className="candidate-drawer candidate-drawer-open" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>',
  'dialog semantics',
)

replaceOnce(
  '<button className="drawer-close" onClick={onClose} aria-label="Close">×</button>',
  '<button ref={closeButtonRef} className="drawer-close" onClick={onClose} aria-label="Close profile drawer">×</button>',
  'close focus target',
)

replaceOnce(
  '<h2 className="drawer-name">{result.displayName}</h2>',
  '<h2 id={titleId} className="drawer-name">{result.displayName}</h2>',
  'dialog title',
)

replaceOnce(
  `            <FindContactButton
              isAuthenticated={!publicMode}
              source={{
                sourceProfileId: result.sourceProfileId,
                displayName: result.displayName,
                headline: result.headline,
                organization: result.organization,
                location: result.location,
                profileUrl: result.profileUrl,
                source: result.source,
              }}
            />`,
  `            {canSaveCandidate && (
              <FindContactButton
                isAuthenticated={!publicMode}
                source={{
                  sourceProfileId: result.sourceProfileId,
                  displayName: result.displayName,
                  headline: result.headline,
                  organization: result.organization,
                  location: result.location,
                  profileUrl: result.profileUrl,
                  source: result.source,
                }}
              />
            )}`,
  'contact actions limited to people',
)

replaceOnce(
  `          ) : (
            <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
              <button className="btn" style={{ flex: 1 }} onClick={saveSourceProfile} disabled={saving}>
                {saving ? 'Saving…' : publicMode ? 'Save source profile (beta)' : projectId ? '+ Save and add to project' : '+ Save source profile'}
              </button>
              <span className="muted" style={{ fontSize: '11px', textAlign: 'center' }}>
                Saving creates a source profile record. Candidate 360 still requires recruiter confirmation.
              </span>
            </div>
          )}`,
  `          ) : canSaveCandidate ? (
            <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
              <button className="btn" style={{ flex: 1 }} onClick={saveSourceProfile} disabled={saving}>
                {saving ? 'Saving…' : publicMode ? 'Save person profile (beta)' : projectId ? '+ Save person and add to project' : '+ Save person profile'}
              </button>
              <span className="muted" style={{ fontSize: '11px', textAlign: 'center' }}>
                Saving creates a pending candidate record. Recruiter identity confirmation is still required.
              </span>
            </div>
          ) : (
            <div className="drawer-preview-note drawer-preview-unsaved">
              {entityKindLabels[entityKind]} source subjects can be reviewed as evidence but cannot be saved or added to a role as candidates.
            </div>
          )}`,
  'non-person footer',
)

fs.writeFileSync(path, text)
console.log('Applied V28.1 CandidateDrawer accessibility and entity safeguards')
