import 'server-only'

export type AiGatewayAuthModeV39_1 = 'api_key' | 'vercel_oidc' | 'not_configured'

export type AiGatewayStatusV39_1 = {
  configured: boolean
  authMode: AiGatewayAuthModeV39_1
  model: string
  transport: 'vercel_ai_gateway'
  gatewayRequestRuntimeIntegrated: boolean
  aiSdkRuntimeIntegrated: boolean
  secretMaterialExposed: false
  note: string
}

function present(value: string | undefined): boolean {
  return Boolean(value && value.trim())
}

/**
 * Runtime configuration only. Never return or log the gateway key/OIDC token.
 * V40 routes the existing SourcingOS reasoning abstraction through AI Gateway's
 * OpenAI-compatible Responses endpoint without adding another package. The
 * first-party AI SDK tool-runtime remains a subsequent atomic dependency step.
 */
export function aiGatewayStatusV39_1(): AiGatewayStatusV39_1 {
  const authMode: AiGatewayAuthModeV39_1 = present(process.env.AI_GATEWAY_API_KEY)
    ? 'api_key'
    : present(process.env.VERCEL_OIDC_TOKEN)
      ? 'vercel_oidc'
      : 'not_configured'

  return {
    configured: authMode !== 'not_configured',
    authMode,
    model: process.env.AI_GATEWAY_MODEL?.trim() || process.env.AI_PROVIDER_MODEL?.trim() || 'openai/gpt-5.6-sol',
    transport: 'vercel_ai_gateway',
    gatewayRequestRuntimeIntegrated: true,
    aiSdkRuntimeIntegrated: false,
    secretMaterialExposed: false,
    note: authMode === 'not_configured'
      ? 'AI Gateway credentials were not detected in this runtime; direct provider fallback may still be configured.'
      : 'Vercel AI Gateway is now an active SourcingOS reasoning transport. First-party AI SDK tool execution remains gated on the atomic dependency/lockfile tranche.',
  }
}
