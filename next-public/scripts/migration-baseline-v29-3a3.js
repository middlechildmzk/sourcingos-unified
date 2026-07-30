/**
 * V29.3A3 baseline-alignment manifest wrapper.
 *
 * Reuses the proven zero-change baseline harness and changes only the exact
 * ordered active-migration allowlist. The generated runtime copy is removed.
 */
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const scriptsDir = __dirname
const sourcePath = path.join(scriptsDir, 'migration-baseline-alignment.js')
const runtimePath = path.join(scriptsDir, `.migration-baseline-v29-3a3-${process.pid}.js`)
const previous = `const EXPECTED_ACTIVE = [
  '20260730172500_canonical_baseline_anchor.sql',
  '20260730181000_durable_identity_foundation.sql',
]`
const next = `const EXPECTED_ACTIVE = [
  '20260730172500_canonical_baseline_anchor.sql',
  '20260730181000_durable_identity_foundation.sql',
  '20260730194500_transactional_identity_decisions.sql',
]`

try {
  const source = fs.readFileSync(sourcePath, 'utf8')
  if (!source.includes(previous)) {
    throw new Error('Could not locate the strict V29.3A0.2 active-migration manifest.')
  }
  const patched = source
    .replace(previous, next)
    .replace(
      'active Supabase migrations match the exact approved ordered pair',
      'active Supabase migrations match the exact approved ordered V29.3 stack',
    )
  fs.writeFileSync(runtimePath, patched)
  const result = spawnSync(process.execPath, [runtimePath], {
    cwd: path.resolve(scriptsDir, '..'),
    env: process.env,
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  process.exitCode = result.status === null ? 1 : result.status
} catch (error) {
  console.error(`BASELINE MANIFEST WRAPPER ERROR: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
} finally {
  try { fs.unlinkSync(runtimePath) } catch {}
}
