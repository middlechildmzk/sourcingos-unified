import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const page = read('app/app/search/page.tsx')
const workspace = read('components/SearchWorkspaceV37.tsx')
const peopleRedirect = read('app/app/people-search/page.tsx')
const agenticRedirect = read('app/app/agentic-sourcing/page.tsx')
const labRedirect = read('app/app/candidate-search/page.tsx')

describe('V37 canonical Search Workspace', () => {
  it('owns one authenticated people-search route while preserving legacy URLs as redirects', () => {
    expect(page).toContain('<SearchWorkspaceV37')
    expect(peopleRedirect).toContain("redirect('/app/search?from=people-search')")
    expect(agenticRedirect).toContain("redirect('/app/search?from=agentic-sourcing')")
    expect(labRedirect).toContain('/app/search?')
  })

  it('accepts role/query presets without auto-running provider search', () => {
    expect(page).toContain('initialQuery={sp.q || \'\'}')
    expect(page).toContain('roleId={sp.roleId}')
    expect(workspace).toContain('setQuery(rolePrompt(role))')
    expect(workspace).toContain('nothing runs until you press Search.')
    expect(workspace).not.toMatch(/useEffect\([^]*run\(\)/)
  })

  it('keeps conversational refinements attached to the prior people plan', () => {
    expect(workspace).toContain('...(previousPlan ? { previousPlan } : {})')
    expect(workspace).toContain('setPreviousPlan(next)')
  })

  it('keeps paid contact reads behind an explicit recruiter approval action', () => {
    expect(workspace).toContain("plan?.action === 'approval_required'")
    expect(workspace).toContain('Approve contact lookup')
    expect(workspace).toContain("fetch('/api/contact-enrichment/find'")
    expect(workspace).toContain("purpose: 'contact_bundle'")
    expect(workspace).not.toContain('send_outreach')
    expect(workspace).not.toContain('sync_ats')
  })

  it('does not present unsupported save or canonical-profile actions on raw search observations', () => {
    expect(workspace).not.toContain('>Save</button>')
    expect(workspace).not.toContain('>Open Candidate 360</button>')
    expect(workspace).toContain('Search observations are read-only')
  })
})
