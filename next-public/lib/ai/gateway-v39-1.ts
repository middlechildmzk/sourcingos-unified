import 'server-only'

export type AiGatewayAuthModeV39_1 = 'api_key' | 'vercel_oidc' | 'not_configured'

export type AiGatewayStatusV39_1 = {
  configured: boolean
  authMode: AiGatewayAuthModeV39_1
  model: string
  transport: 'vercel_ai_gateway'
  aiSdkRuntimeIntegrated: boolean
  secretMaterialExposed: false
  note: string
}

function present(value: string | undefined): boolean {
  return Boolean(value && value.trim())
}

/**
 * Runtime configuration only. Never return or log the gateway key/OIDC token.
 * Vercel-hosted deployments can authenticate to AI Gateway with the deployment
 * OIDC token; an explicit AI_GATEWAY_API_KEY remains useful for local execution
 * and key-scoped spend controls.
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
    model: process.env.AI_GATEWAY_MODEL?.trim() || 'openai/gpt-5.6-sol',
    transport: 'vercel_ai_gateway',
    // The repository does not yet include the Vercel AI SDK dependency. Keep
    // this false until package.json + package-lock are upgraded atomically and
    // the real structured/tool-calling path passes CI and Preview.
    aiSdkRuntimeIntegrated: false,
    secretMaterialExposed: false,
    note: authMode === 'not_configured'
      ? 'AI Gateway credentials were not detected in this runtime.'
      : 'Vercel AI Gateway authentication is available; AI SDK execution is gated on the atomic dependency/lockfile integration step.',
  }
}
