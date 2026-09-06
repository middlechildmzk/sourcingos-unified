export function parallelResponsesTextV40_7e(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text.trim()
  const output = Array.isArray(payload.output) ? payload.output : []
  return output.flatMap(value => {
    const row = value && typeof value === 'object' ? value as Record<string, unknown> : {}
    const content = Array.isArray(row.content) ? row.content : []
    return content.map(part => {
      const block = part && typeof part === 'object' ? part as Record<string, unknown> : {}
      return typeof block.text === 'string' ? block.text.trim() : ''
    }).filter(Boolean)
  }).join('\n').trim()
}

export async function runParallelResponsesSynthesisV40_7e(input: {
  key: string
  prompt: string
}): Promise<{ model: 'parallel'; text: string }> {
  const response = await fetch('https://api.parallel.ai/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'parallel',
      input: input.prompt,
      reasoning: { effort: 'low' },
    }),
    cache: 'no-store',
  })
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 1200)
    throw new Error(`Parallel Responses fleet worker returned HTTP ${response.status}${detail ? `: ${detail}` : '.'}`)
  }
  const payload = await response.json() as Record<string, unknown>
  const text = parallelResponsesTextV40_7e(payload)
  if (!text) throw new Error('Parallel Responses fleet worker returned no text output.')
  return { model: 'parallel', text }
}
