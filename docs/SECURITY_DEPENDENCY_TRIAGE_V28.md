# V28 dependency and build-risk triage

Date: 2026-07-22

This document records the dependency findings from the locked V27 CI audit artifact and defines the Phase 0 response. It does not claim the advisories are resolved.

## Audit snapshot

Full dependency tree:

- 0 low
- 4 moderate
- 7 high
- 1 critical

`npm audit --omit=dev` report:

- 0 critical
- 3 high
- 1 moderate

The production report includes `@playwright/test` even though it is declared under `devDependencies`; it is not imported by the production application. The runtime packages that require a framework decision are Next.js and its bundled PostCSS dependency.

## Runtime framework findings

Current framework: Next.js 14.2.35.

The audit associates the installed Next.js range with multiple advisories, including:

- GHSA-h25m-26qc-wcjf: request deserialization denial of service
- GHSA-q4gf-8mx6-v5v3 and GHSA-8h8q-6873-q5fj: Server Component denial of service
- GHSA-c4j6-fc7j-m34r: WebSocket upgrade server-side request forgery
- GHSA-36qx-fr4f-26g5: middleware or proxy bypass in affected configurations
- GHSA-wfc6-r584-vfw7: React Server Component cache poisoning
- GHSA-qx2v-qp2m-jg93: PostCSS unsafe stringification

The npm audit resolver recommends a major framework upgrade. A forced audit fix is not acceptable because it would change Next.js, React compatibility, linting, and build behavior without application regression testing.

### Required response

1. Create a dedicated framework-security branch from the stabilized V28 baseline.
2. Upgrade to a currently supported patched Next.js release and its compatible React version.
3. Regenerate the lockfile through npm, never by hand.
4. Run all deterministic tests, the PostgreSQL contract, production build, and authenticated browser QA.
5. Review middleware, rewrites, image configuration, server actions, caching, and route handlers against the advisory conditions.
6. Do not widen beta access until the runtime advisory set is either remediated or formally accepted with documented compensating controls.

## Development-tool findings

### Vitest

Current: 2.1.9.

The full audit reports a critical advisory affecting Vitest versions below 3.2.6, plus transitive Vite, esbuild, vite-node, and mocker findings. SourcingOS runs `vitest run` in CI and does not expose the Vitest UI or development server publicly, which reduces exploitability but does not remove the need to upgrade.

Required response:

- Upgrade Vitest to a patched supported release in a dedicated tooling change.
- Regenerate the lockfile.
- Verify JSON reporter compatibility and the complete test suite.
- Keep Vitest UI and development servers inaccessible from untrusted networks.

### Playwright

Current: 1.49.1.

The audit reports GHSA-7mvr-c777-76hp for Playwright versions below 1.55.1. Playwright is a test-only dependency.

Required response:

- Upgrade `@playwright/test` to a patched release.
- Reinstall browser binaries in CI.
- Run the authenticated critical-path suite after the test harness is available.

### ESLint and glob

The full audit reports a high-severity glob CLI command-injection advisory through the Next.js ESLint configuration. The application does not invoke glob's CLI with untrusted arguments in production, but the lint toolchain should be upgraded with the framework-security work.

## Existing build warnings to track

Previous production builds completed with warnings concerning:

- Supabase code referencing `process.version` in an Edge-compatible bundle
- CSS compatibility and autoprefixer output
- React Hook dependency warnings
- dependency audit totals

The V28 build log must be reviewed after typecheck and production build complete. Warnings should be assigned to a specific follow-up item rather than treated as harmless by default.

## Phase 0 release gate

Phase 0 can remain a preview-only stabilization branch while the following are true:

- no production database mutations occur
- current browser and persistence blockers are clearly labeled
- the dependency findings remain documented

A wider beta release requires a deliberate decision on the Next.js runtime advisories, plus completion of authenticated QA and database migration validation.
