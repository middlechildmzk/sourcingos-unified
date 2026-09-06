export type FleetSynthesisResolutionV40_7c =
  | { kind: 'gateway'; model: string; authSource: 'ai_gateway_api_key' | 'vercel_oidc' }
  | { kind: 'parallel'; model: 'parallel'; authSource: 'parallel_api_key' }
  | { kind: 'anthropic'; model: string; authSource: 'anthropic_api_key' }
  | { kind: 'unavailable'; model: null; authSource: null }

function value(env: Record<string, string | undefined>, key: string): string {
  return String(env[key] || '').trim()
}

function gatewayModel(env: Record<string, string | undefined>): string {
  const explicit = value(env, 'AGENT_FLEET_GATEWAY_MODEL')
  if (explicit.includes('/')) return explicit
  const fleet = value(env, 'AGENT_FLEET_MODEL')
  if (fleet.includes('/')) return fleet
  const generic = value(env, 'AI_PROVIDER_MODEL')
  if (generic.includes('/')) return generic
  return 'openai/gpt-5.6-sol'
}

function anthropicModel(env: Record<string, string | undefined>): string {
  const candidates = [
    value(env, 'AGENT_FLEET_MODEL'),
    value(env, 'ANTHROPIC_MODEL'),
    value(env, 'AI_PROVIDER_MODEL'),
  ]
  return candidates.find(model => /^claude[-/]/i.test(model)) || 'claude-sonnet-4-6'
}

export function resolveFleetSynthesisProviderV40_7c(
  env: Record<string, string | undefined>,
): FleetSynthesisResolutionV40_7c {
  if (value(env, 'AI_GATEWAY_API_KEY')) {
    return { kind: 'gateway', model: gatewayModel(env), authSource: 'ai_gateway_api_key' }
  }
  if (value(env, 'VERCEL_OIDC_TOKEN')) {
    return { kind: 'gateway', model: gatewayModel(env), authSource: 'vercel_oidc' }
  }
  if (value(env, 'PARALLEL_API_KEY')) {
    return { kind: 'parallel', model: 'parallel', authSource: 'parallel_api_key' }
  }
  if (value(env, 'ANTHROPIC_API_KEY')) {
    return { kind: 'anthropic', model: anthropicModel(env), authSource: 'anthropic_api_key' }
  }
  return { kind: 'unavailable', model: null, authSource: null }
}
