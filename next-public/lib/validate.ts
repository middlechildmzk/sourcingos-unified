// ─────────────────────────────────────────────────────────────────────────────
// lib/validate.ts — Request-body validation with payload size caps.
//
// Reads the raw body, enforces a byte limit BEFORE parsing, JSON-parses, then
// zod-validates. Returns a typed result or a ready 400/413 response. Error
// payloads never echo the submitted body and never include internals.
// SERVER-ONLY.
// ─────────────────────────────────────────────────────────────────────────────
import 'server-only'
import { NextResponse } from 'next/server'
import type { ZodTypeAny, infer as ZInfer } from 'zod'

export interface ParseOk<T> { ok: true; data: T }
export interface ParseFail { ok: false; response: NextResponse }
export type ParseResult<T> = ParseOk<T> | ParseFail

const DEFAULT_MAX_BYTES = 64 * 1024 // 64KB default for app routes

function bad(status: 400 | 413, error: string): ParseFail {
  return {
    ok: false,
    response: NextResponse.json({ ok: false, code: 'invalid_body', error }, { status }),
  }
}

/**
 * Usage:
 *   const body = await parseBody(req, schema)            // 64KB cap
 *   const body = await parseBody(req, schema, 2 * 1024)  // custom cap
 *   if (!body.ok) return body.response
 */
export async function parseBody<S extends ZodTypeAny>(
  req: Request,
  schema: S,
  maxBytes: number = DEFAULT_MAX_BYTES
): Promise<ParseResult<ZInfer<S>>> {
  let raw: string
  try {
    raw = await req.text()
  } catch {
    return bad(400, 'Unable to read request body.')
  }

  if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
    return bad(413, 'Request body too large.')
  }

  let json: unknown
  try {
    json = raw ? JSON.parse(raw) : {}
  } catch {
    return bad(400, 'Request body must be valid JSON.')
  }

  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    // Field names only — never echo values or zod internals beyond paths.
    const fields = Array.from(
      new Set(parsed.error.issues.map(i => i.path.join('.') || '(root)'))
    ).slice(0, 8)
    return bad(400, `Invalid request body. Check: ${fields.join(', ')}`)
  }

  return { ok: true, data: parsed.data }
}
