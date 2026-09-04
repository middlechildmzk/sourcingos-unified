// ─────────────────────────────────────────────────────────────────────────────
// lib/ai/provider.ts — SERVER-ONLY AI provider abstraction.
//
// SourcingOS owns recruiter semantics, tools, evidence, and workflow. The model
// is a swappable reasoning layer. Vercel AI Gateway is preferred when its
// deployment OIDC token or an explicit gateway key is available, while direct
// Anthropic/OpenAI configuration remains a supported fallback. Credentials are
// never returned to the client or included in prompts.
// ─────────────────────────────────────────────────────────────────────────────
import 'server-only'

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages'
const OPENAI_ENDPOINT = 'https://api.openai.com/v1/responses'
const VERCEL_GATEWAY_RESPONSES_ENDPOINT = 'https://ai-gateway.vercel.sh/v1/responses'

type AiProviderName = 'vercel_gateway' | 'anthropic' | 'openai'

export type AiProviderStatus = {
  configured: boolean
  provider?: AiProviderName
  model?: string
}

function requestedProvider(): AiProviderName | undefined {
  const value = String(process.env.AI_PROVIDER || '').trim().toLowerCase()
  if (value === 'openai' || value === 'anthropic') return value
  if (['vercel', 'gateway', 'vercel_gateway', 'vercel-ai-gateway'].includes(value)) return 'vercel_gateway'
  return undefined
}

function gatewayToken(): string | undefined {
  return process.env.AI_GATEWAY_API_KEY?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim() || undefined
}

function anthropicKey(): string | undefined {
  const explicit = process.env.ANTHROPIC_API_KEY?.trim()
  if (explicit) return explicit
  return requestedProvider() !== 'openai' && requestedProvider() !== 'vercel_gateway'
    ? process.env.AI_PROVIDER_API_KEY?.trim() || undefined
    : undefined
}

function openAiKey(): string | undefined {
  const explicit = process.env.OPENAI_API_KEY?.trim()
  if (explicit) return explicit
  return requestedProvider() === 'openai' ? process.env.AI_PROVIDER_API_KEY?.trim() || undefined : undefined
}

function activeProvider(): AiProviderName | undefined {
  const requested = requestedProvider()
  if (requested === 'vercel_gateway' && gatewayToken()) return 'vercel_gateway'
  if (requested === 'openai' && openAiKey()) return 'openai'
  if (requested === 'anthropic' && anthropicKey()) return 'anthropic'

  // On Vercel, prefer the centralized Gateway whenever OIDC/key auth is present.
  // This keeps model routing, spend controls, and provider selection out of the
  // application surface while retaining direct-provider fallbacks for local use.
  if (gatewayToken()) return 'vercel_gateway'
  if (anthropicKey()) return 'anthropic'
  if (openAiKey()) return 'openai'
  return undefined
}

function modelFor(provider: AiProviderName): string {
  if (provider === 'vercel_gateway') {
    return process.env.AI_GATEWAY_MODEL?.trim() || process.env.AI_PROVIDER_MODEL?.trim() || 'openai/gpt-5.6-sol'
  }
  const configured = process.env.AI_PROVIDER_MODEL?.trim()
  if (configured) return configured
  return provider === 'openai' ? 'gpt-5.6-luna' : 'claude-3-5-haiku-20241022'
}

export function aiProviderStatus(): AiProviderStatus {
  const provider = activeProvider()
  return provider
    ? { configured: true, provider, model: modelFor(provider) }
    : { configured: false }
}

export function isAiConfigured(): boolean {
  return aiProviderStatus().configured
}

export interface AiCallResult<T> {
  ok: boolean
  data?: T
  error?: string
  aiGenerated: boolean
  provider?: AiProviderName
  model?: string
}

function parseJsonText<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  return JSON.parse(cleaned) as T
}

function responseOutputText(json: {
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>
}): string {
  return (json.output || [])
    .flatMap(item => item.content || [])
    .filter(item => item.type === 'output_text' || typeof item.text === 'string')
    .map(item => item.text || '')
    .join('\n')
    .trim()
}

async function callAnthropicJson<T>(prompt: string, key: string, model: string, maxTokens: number): Promise<AiCallResult<T>> {
  try {
    const res = await fetch(ANTHROPIC_ENDPOINT, {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
      cache: 'no-store',
    })
    if (!res.ok) return { ok: false, error: 'provider_error', aiGenerated: false, provider: 'anthropic', model }
    const json = await res.json() as { content?: { type: string; text?: string }[] }
    const text = (json.content || []).filter(block => block.type === 'text').map(block => block.text || '').join('\n').trim()
    if (!text) return { ok: false, error: 'empty_response', aiGenerated: false, provider: 'anthropic', model }
    return { ok: true, data: parseJsonText<T>(text), aiGenerated: true, provider: 'anthropic', model }
  } catch {
    return { ok: false, error: 'parse_or_network_error', aiGenerated: false, provider: 'anthropic', model }
  }
}

async function callResponsesJson<T>(
  endpoint: string,
  prompt: string,
  key: string,
  model: string,
  maxTokens: number,
  provider: 'openai' | 'vercel_gateway',
): Promise<AiCallResult<T>> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: prompt,
        max_output_tokens: maxTokens,
        store: false,
        text: { format: { type: 'json_object' } },
      }),
      cache: 'no-store',
    })
    if (!res.ok) return { ok: false, error: 'provider_error', aiGenerated: false, provider, model }
    const json = await res.json() as {
      output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>
    }
    const text = responseOutputText(json)
    if (!text) return { ok: false, error: 'empty_response', aiGenerated: false, provider, model }
    return { ok: true, data: parseJsonText<T>(text), aiGenerated: true, provider, model }
  } catch {
    return { ok: false, error: 'parse_or_network_error', aiGenerated: false, provider, model }
  }
}

/** Call the configured reasoning model with a prompt expecting JSON output. */
export async function callModelJson<T>(prompt: string, maxTokens = 1200): Promise<AiCallResult<T>> {
  const provider = activeProvider()
  if (!provider) return { ok: false, error: 'not_configured', aiGenerated: false }
  const model = modelFor(provider)
  if (provider === 'vercel_gateway') {
    return callResponsesJson<T>(VERCEL_GATEWAY_RESPONSES_ENDPOINT, prompt, gatewayToken()!, model, maxTokens, 'vercel_gateway')
  }
  if (provider === 'openai') {
    return callResponsesJson<T>(OPENAI_ENDPOINT, prompt, openAiKey()!, model, maxTokens, 'openai')
  }
  return callAnthropicJson<T>(prompt, anthropicKey()!, model, maxTokens)
}
