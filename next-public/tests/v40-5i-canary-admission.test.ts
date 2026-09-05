import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/**
 * The V40.5i canary ceiling is enforced by PostgreSQL, so the meaningful proof
 * has to run against a real database rather than assert on SQL text. These
 * cases execute the shipped migration and exercise the claim function
 * directly, including two genuinely overlapping transactions.
 *
 * They run when a Postgres is reachable (set PGTEST_PSQL, e.g.
 * PGTEST_PSQL="psql -h /tmp -p 5433 -U postgres") and skip otherwise, so the
 * suite stays green on machines and CI runners without one. The structural
 * assertions at the bottom always run.
 */
const root = path.resolve(process.cwd())
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const PSQL = process.env.PGTEST_PSQL

function runScript(script: string): string {
  return execFileSync('bash', [path.join(root, 'tests/sql', script)], {
    env: { ...process.env, PSQL },
    encoding: 'utf8',
    timeout: 120_000,
  })
}

function parseRows(output: string) {
  return output
    .split('\n')
    .map(line => line.trim())
    .filter(line => /\|(PASS|FAIL)$/.test(line))
    .map(line => {
      const [label, actual, expected, verdict] = line.split('|')
      return { label, actual: Number(actual), expected: Number(expected), verdict }
    })
}

describe.skipIf(!PSQL)('V40.5i canary admission, proven against real PostgreSQL', () => {
  it('enforces the ceiling across every admission scenario', () => {
    const rows = parseRows(runScript('run-v40-5i-canary-admission.sh'))
    expect(rows.length).toBeGreaterThanOrEqual(11)
    const byLabel = Object.fromEntries(rows.map(row => [row.label, row]))

    // The ceiling itself.
    expect(byLabel.ceiling6_from_zero).toMatchObject({ actual: 6, verdict: 'PASS' })
    expect(byLabel.four_running_admits_two_more).toMatchObject({ actual: 6, verdict: 'PASS' })
    expect(byLabel.ceiling_full_admits_zero).toMatchObject({ actual: 6, verdict: 'PASS' })
    expect(byLabel.repeated_ticks_hold_at_6).toMatchObject({ actual: 6, verdict: 'PASS' })

    // Failure must not manufacture unlimited admission capacity.
    expect(byLabel.failed_admissions_do_not_free_slots).toMatchObject({ actual: 6, verdict: 'PASS' })

    // In-flight canary work always finishes.
    expect(byLabel.parse_drains_when_search_ceiling_full).toMatchObject({ actual: 5, verdict: 'PASS' })

    // Legacy V40.5b-h attempts are not V40.5i admissions.
    expect(byLabel.legacy_attempts_do_not_consume_slots).toMatchObject({ actual: 6, verdict: 'PASS' })

    // Fail-closed rollout shim.
    expect(byLabel.legacy_shim_admits_zero_searches).toMatchObject({ actual: 0, verdict: 'PASS' })
    expect(byLabel.legacy_shim_admits_nothing_into_canary).toMatchObject({ actual: 0, verdict: 'PASS' })
    expect(byLabel.legacy_shim_still_drains_parse).toMatchObject({ actual: 3, verdict: 'PASS' })

    // Scaled mode is the only bypass, and only when explicitly enabled.
    expect(byLabel.scaled_mode_bypasses_ceiling).toMatchObject({ actual: 36, verdict: 'PASS' })

    expect(rows.every(row => row.verdict === 'PASS')).toBe(true)
  })

  it('holds the ceiling when two claim transactions genuinely overlap', () => {
    // Without the advisory lock this admits 12 against a ceiling of 6 -- the
    // cross-tick race that a completion-based count cannot prevent.
    const rows = parseRows(runScript('run-v40-5i-concurrency.sh'))
    expect(rows).toHaveLength(1)
    expect(rows[0].label).toBe('concurrent_overlap_admits_at_most_6')
    expect(rows[0].actual).toBeLessThanOrEqual(6)
    expect(rows[0].verdict).toBe('PASS')
  })
})

describe('V40.5i admission and rollout structure', () => {
  const migration = read('supabase/migrations/20260905030000_v40_5i_provider_agnostic_resume_discovery.sql')

  it('stamps admission at claim time under a transaction-scoped advisory lock', () => {
    expect(migration).toContain('pg_advisory_xact_lock')
    expect(migration).toContain("'{v40_5i_admitted}', 'true'::jsonb, true")
    expect(migration).toContain('limit v_headroom')
    // Admission must be counted from the claim-time marker, never from
    // completion state, or in-flight candidates become invisible.
    expect(migration).toContain("coalesce(t.payload->>'v40_5i_admitted','') = 'true'")
  })

  it('never drops the legacy signature, and leaves it fail-closed instead', () => {
    expect(migration).not.toContain('drop function if exists public.claim_resume_sprint_tasks_v40_5(')
    expect(migration).toContain('create or replace function public.claim_resume_sprint_tasks_v40_5(')
    // The legacy 3-arg shim may claim parse work only.
    const legacy = migration.slice(migration.indexOf('FAIL-CLOSED LEGACY COMPATIBILITY SHIM'))
    expect(legacy).toContain("t.task_kind = 'resume_fetch_parse'")
    expect(legacy).not.toContain("t.task_kind = 'resume_search'")
  })

  it('avoids RPC overload ambiguity by using a distinct function name', () => {
    // Exactly one definition of each name; no overloading of either.
    expect(migration.match(/create or replace function public\.claim_resume_sprint_tasks_v40_5\(/g)).toHaveLength(1)
    expect(migration.match(/create or replace function public\.claim_resume_sprint_tasks_v40_5i\(/g)).toHaveLength(1)
  })

  it('calls the new gated function from the sprint runtime', () => {
    const sprint = read('lib/fleet/resume-sprint-v40-5.ts')
    expect(sprint).toContain("sb.rpc('claim_resume_sprint_tasks_v40_5i'")
    expect(sprint).toContain('resumeSprintClaimArgsV40_5I')
    expect(sprint).not.toContain("sb.rpc('claim_resume_sprint_tasks_v40_5'")
  })

  it('passes the ceiling and mode into the database rather than deciding in the app', () => {
    const gate = read('lib/fleet/resume-providers/release-gate-v40-5i.ts')
    expect(gate).toContain('p_canary_ceiling')
    expect(gate).toContain('p_scaled')
    expect(gate).toContain('ENFORCEMENT LIVES IN POSTGRES')
  })
})
