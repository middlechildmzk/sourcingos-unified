// ─────────────────────────────────────────────────────────────────────────────
// lib/contact-enrichment/index.ts — Client-safe barrel.
//
// Exports ONLY client-safe modules (types + request builder). The live PDL
// adapter and provider-status helper are server-only and imported directly
// by the API route, never through this barrel.
// ─────────────────────────────────────────────────────────────────────────────
export * from './types'
export * from './build-request'
