import { describe, expect, it } from 'vitest'
import { parallelResponsesTextV40_7e } from '@/lib/fleet/parallel-responses-synthesis-v40-7e'
import { resolveFleetSynthesisProviderV40_7c } from '@/lib/fleet/synthesis-provider-v40-7c'

describe('V40.7e Parallel Responses fleet synthesis', () => {
  it('uses configured Parallel synthesis before an unfunded Anthropic fallback', () => {
    expect(resolveFleetSynthesisProviderV40_7c({
      PARALLEL_API_KEY: 'parallel',
      ANTHROPIC_API_KEY: 'anthropic',
    })).toEqual({ kind: 'parallel', model: 'parallel', authSource: 'parallel_api_key' })
  })

  it('still prefers an explicitly configured Vercel AI Gateway', () => {
    expect(resolveFleetSynthesisProviderV40_7c({
      AI_GATEWAY_API_KEY: 'gateway',
      PARALLEL_API_KEY: 'parallel',
    }).kind).toBe('gateway')
  })

  it('reads the Responses output_text convenience field', () => {
    expect(parallelResponsesTextV40_7e({ output_text: '  structured answer  ' })).toBe('structured answer')
  })

  it('falls back to standard Responses output content', () => {
    expect(parallelResponsesTextV40_7e({
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'first' }, { type: 'output_text', text: 'second' }] }],
    })).toBe('first\nsecond')
  })
})
