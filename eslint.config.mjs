// ─────────────────────────────────────────────────────────────────────────────
// eslint.config.mjs — ESLint 9 flat config.
//
// Next.js 16 removed `next lint`, and eslint-config-next@16 requires ESLint 9,
// which uses flat config. This replaces the previous .eslintrc.json
// ("extends": "next/core-web-vitals") with the equivalent flat setup.
// ─────────────────────────────────────────────────────────────────────────────
import coreWebVitals from 'eslint-config-next/core-web-vitals'

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**', 'coverage/**', 'playwright-report/**', 'test-results/**'],
  },
  ...(Array.isArray(coreWebVitals) ? coreWebVitals : [coreWebVitals]),
  {
    rules: {
      // See "Staged rules" note at the bottom of this file.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Staged rules — introduced by eslint-config-next@16 / the React Compiler rule
// set, not by any behavior change in this codebase.
//
// `react-hooks/set-state-in-effect` currently fires 31 times across 29 client
// components. Each one is a real cascading-render smell worth fixing, but doing
// so is a behavioral refactor of client state and must not ride along with a
// framework upgrade. Kept at "warn" so the upgrade lands green and the warnings
// stay visible. Tracked as a separate unit of work.
//
// `react-hooks/purity` (CandidateAcquisitionHubClient.tsx) and
// `react-hooks/preserve-manual-memoization` (WorkbenchClient.tsx) are staged for
// the same reason: both require touching render-time logic.
// ─────────────────────────────────────────────────────────────────────────────

export default config
