'use client'

import { useState } from 'react'
import { SearchWorkspaceV38_1 } from '@/components/SearchWorkspaceV38_1'
import { PersonLookupV38_4 } from '@/components/PersonLookupV38_4'
import styles from './PeopleSearchWorkspaceV38_4.module.css'

export function PeopleSearchWorkspaceV38_4({ initialQuery = '', roleId, source }: { initialQuery?: string; roleId?: string; source?: string }) {
  const [mode, setMode] = useState<'source' | 'person'>(source === 'person-lookup' ? 'person' : 'source')

  return <div className={styles.shell}>
    <div className={styles.switcher} role="tablist" aria-label="People Search mode">
      <button type="button" role="tab" aria-selected={mode === 'source'} data-active={mode === 'source'} onClick={() => setMode('source')}>
        <strong>Source talent</strong>
        <span>Describe the people you need</span>
      </button>
      <button type="button" role="tab" aria-selected={mode === 'person'} data-active={mode === 'person'} onClick={() => setMode('person')}>
        <strong>Find a person</strong>
        <span>Name, company, email or profile URL</span>
      </button>
    </div>
    {mode === 'source'
      ? <SearchWorkspaceV38_1 initialQuery={initialQuery} roleId={roleId} source={source} />
      : <PersonLookupV38_4 initialQuery={initialQuery} roleId={roleId} />}
  </div>
}
