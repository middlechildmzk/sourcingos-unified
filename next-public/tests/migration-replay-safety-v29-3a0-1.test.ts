import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  HELD_REPO_MIGRATIONS,
  ORPHANED_SQL,
  PRODUCTION_LEDGER_ENTRIES,
  PRODUCTION_SEQUENCE,
} from '../lib/migration-manifest'

const root = process.cwd()
const read = (relativePath: string) => readFileSync(join(root, relativePath), 'utf8')
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, '')

describe('V29.3A0.1 - preserved reconciliation coverage', () => {
  it('keeps every remote ledger entry mapped to historical SQL rather than held migrations', () => {
    const historicalLedgerNames = PRODUCTION_SEQUENCE.map(record => record.ledgerName).filter(Boolean).sort()
    expect(historicalLedgerNames).toEqual([...PRODUCTION_LEDGER_ENTRIES].sort())
    expect(HELD_REPO_MIGRATIONS.every(record => record.ledgerName === null)).toBe(true)
  })

  it('keeps every historical table creation guarded by IF NOT EXISTS', () => {
    for (const record of PRODUCTION_SEQUENCE) {
      const sql = stripComments(read(record.file)).toLowerCase()
      const creates = (sql.match(/create table/g) || []).length
      const guarded = (sql.match(/create table if not exists/g) || []).length
      expect(guarded, `${record.file} guards every create table`).toBe(creates)
    }
  })

  it('keeps all orphaned SQL outside the reconstructed production sequence', () => {
    const sequenceFiles = new Set(PRODUCTION_SEQUENCE.map(record => record.file))
    for (const orphan of ORPHANED_SQL) {
      expect(sequenceFiles.has(orphan.file), `${orphan.file} must remain outside production reconstruction`).toBe(false)
    }
  })
})
