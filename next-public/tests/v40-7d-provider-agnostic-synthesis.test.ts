import { describe, expect, it } from 'vitest'
import { resolveFleetSynthesisProviderV40_7c } from '@/lib/fleet/synthesis-provider-v40-7c'

describe('V40.7d fleet synthesis provider resolution', () => {
  it('prefers an explicit AI Gateway key over Anthropic', () => {
    expect(resolveFleetSynthesisProviderV40_7c({
      AI_GATEWAY_API_KEY: 'gateway',
      ANTHROPIC_API_KEY: 'anthropic',
    })).toEqual({ kind: 'gateway', model: 'openai/gpt-5.6-sol', authSource: 'ai_gateway_api_key' })
  })

  it('uses Vercel OIDC without requiring another secret', () => {
    expect(resolveFleetSynthesisProviderV40_7c({ VERCEL_OIDC_TOKEN: 'oidc' })).toEqual({
      kind: 'gateway',
      model: 'openai/gpt-5.6-sol',
      authSource: 'vercel_oidc',
    })
  })

  it('honors a provider-qualified fleet gateway model', () => {
    expect(resolveFleetSynthesisProviderV40_7c({
      VERCEL_OIDC_TOKEN: 'oidc',
      AGENT_FLEET_GATEWAY_MODEL: 'google/gemini-3.6-flash',
    })).toEqual({ kind: 'gateway', model: 'google/gemini-3.6-flash', authSource: 'vercel_oidc' })
  })

  it('ignores a legacy non-gateway Claude model when resolving Gateway', () => {
    expect(resolveFleetSynthesisProviderV40_7c({
      VERCEL_OIDC_TOKEN: 'oidc',
      AGENT_FLEET_MODEL: 'claude-sonnet-4-6',
    }).model).toBe('openai/gpt-5.6-sol')
  })

  it('falls back to Anthropic only when Gateway auth is unavailable', () => {
    expect(resolveFleetSynthesisProviderV40_7c({
      ANTHROPIC_API_KEY: 'anthropic',
      ANTHROPIC_MODEL: 'claude-sonnet-4-6',
    })).toEqual({ kind: 'anthropic', model: 'claude-sonnet-4-6', authSource: 'anthropic_api_key' })
  })

  it('fails closed when no synthesis provider is configured', () => {
    expect(resolveFleetSynthesisProviderV40_7c({})).toEqual({
      kind: 'unavailable',
      model: null,
      authSource: null,
    })
  })
})
