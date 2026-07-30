/**
 * V29.3A3 held transactional-decision rehearsal wrapper.
 *
 * Both transaction SQL layers remain quarantined under supabase/held-migrations
 * until a separate activation approval. This wrapper reuses the full disposable
 * PostgreSQL harness while changing only held paths, the pre-apply row
 * fingerprint, and the forced concurrency launch. The generated runtime copy is
 * always removed.
 */
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const scriptsDir = __dirname
const sourcePath = path.join(scriptsDir, 'migration-identity-decisions.js')
const runtimePath = path.join(scriptsDir, `.migration-identity-decisions-held-${process.pid}.js`)

try {
  const source = fs.readFileSync(sourcePath, 'utf8')
  const activePath = "const DECISIONS = 'supabase/migrations/20260730194500_transactional_identity_decisions.sql'"
  const heldPaths = `const DECISIONS = 'supabase/held-migrations/20260730194500_transactional_identity_decisions.sql'
const DECISION_SERIALIZATION = 'supabase/held-migrations/20260730194600_transactional_identity_decision_serialization.sql'`
  if (!source.includes(activePath)) throw new Error('Could not locate the A3 migration path.')

  const countPattern = /function canonicalCounts\(database\) \{[\s\S]*?\n\}\n\nfunction decisionSql/
  if (!countPattern.test(source)) throw new Error('Could not locate the A3 pre-apply row fingerprint.')
  const countReplacement = `function canonicalCounts(database) {
  return query(database, \`select concat_ws('|',
    (select count(*) from public.candidates),
    (select count(*) from public.source_profiles),
    (select count(*) from public.evidence_items),
    (select count(*) from public.candidate_contacts),
    (select count(*) from public.identity_match_proposals)
  );\`)
}

function decisionSql`

  const concurrencyPattern = /async function concurrentApproval\(database\) \{[\s\S]*?\n\}/
  if (!concurrencyPattern.test(source)) throw new Error('Could not locate the A3 concurrency fixture.')
  const concurrencyReplacement = `async function concurrentApproval(database) {
  const sqlA = \`begin; select pg_sleep(0.5); \${decisionSql(ids.concurrencyProposalA, 'approve', 'concurrency A')} commit;\`
  const sqlB = \`begin; select pg_sleep(0.5); \${decisionSql(ids.concurrencyProposalB, 'approve', 'concurrency B')} commit;\`
  return Promise.all([runAsyncPsql(database, sqlA), runAsyncPsql(database, sqlB)])
}`

  const firstApply = "assert(apply(db, DECISIONS).ok, 'transactional identity decision migration applies')"
  const firstApplyReplacement = `${firstApply}
  assert(apply(db, DECISION_SERIALIZATION).ok, 'same-profile identity decisions are serialized')`
  const replayApply = "assert(apply(db, DECISIONS).ok, 'transaction migration replays idempotently')"
  const replayApplyReplacement = `${replayApply}
  assert(apply(db, DECISION_SERIALIZATION).ok, 'decision serialization replays idempotently')`
  if (!source.includes(firstApply) || !source.includes(replayApply)) {
    throw new Error('Could not locate the A3 application assertions.')
  }

  const patched = source
    .replace(activePath, heldPaths)
    .replace(countPattern, countReplacement)
    .replace(concurrencyPattern, concurrencyReplacement)
    .replace(firstApply, firstApplyReplacement)
    .replace(replayApply, replayApplyReplacement)

  fs.writeFileSync(runtimePath, patched)
  const result = spawnSync(process.execPath, [runtimePath], {
    cwd: path.resolve(scriptsDir, '..'),
    env: process.env,
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  process.exitCode = result.status === null ? 1 : result.status
} catch (error) {
  console.error(`HELD IDENTITY DECISION WRAPPER ERROR: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
} finally {
  try { fs.unlinkSync(runtimePath) } catch {}
}
