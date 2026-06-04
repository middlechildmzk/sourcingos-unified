// ─────────────────────────────────────────────────────────────────────────────
// lib/ai/provider.ts — SERVER-ONLY AI provider abstraction.
//
// Defaults to Anthropic (api.anthropic.com). Reads AI_PROVIDER_API_KEY (generic)
// or ANTHROPIC_API_KEY. Never exposes the key. If no key, callers fall back to
// deterministic output. Returns parsed JSON or throws a generic error.
// ─────────────────────────────────────────────────────────────────────────────
import 'server-only'

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages'
const MODEL = process.env.AI_PROVIDER_MODEL || 'claude-3-5-haiku-20241022'

export function isAiConfigured(): boolean {
  return Boolean(process.env.AI_PROVIDER_API_KEY || process.env.ANTHROPIC_API_KEY)
}

export interface AiCallResult<T> {
  ok: boolean
  data?: T
  error?: string
  aiGenerated: boolean
}

/** Call the model with a prompt expecting JSON output. Returns parsed JSON. */
export async function callModelJson<T>(prompt: string, maxTokens = 1200): Promise<AiCallResult<T>> {
  const key = process.env.AI_PROVIDER_API_KEY || process.env.ANTHROPIC_API_KEY
  if (!key) {
    return { ok: false, error: 'not_configured', aiGenerated: false }
  }

  try {
    const res = await fetch(ANTHROPIC_ENDPOINT, {
      method: 'POST',
      headers: {
        'x-api-key': key,                         // never logged
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
      cache: 'no-store',
    })

    if (!res.ok) {
      // Generic — never leak provider internals or key
      return { ok: false, error: 'provider_error', aiGenerated: false }
    }

    const json = await res.json() as { content?: { type: string; text?: string }[] }
    const text = (json.content || []).filter(b => b.type === 'text').map(b => b.text || '').join('\n').trim()

    // Strip accidental code fences, then parse
    const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
    const parsed = JSON.parse(cleaned) as T
    return { ok: true, data: parsed, aiGenerated: true }
  } catch {
    return { ok: false, error: 'parse_or_network_error', aiGenerated: false }
  }
}
