import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { safeJsonLd } from '@/lib/safe-json-ld'

describe('safeJsonLd', () => {
  it('neutralizes HTML parser breakout characters while preserving JSON data', () => {
    const payload = { title: '</script><img src=x onerror=alert(1)>', detail: 'A&B\u2028C\u2029D' }
    const serialized = safeJsonLd(payload)

    expect(serialized).not.toContain('</script>')
    expect(serialized).not.toContain('<img')
    expect(serialized).toContain('\\u003c/script\\u003e')
    expect(serialized).toContain('\\u0026')
    expect(JSON.parse(serialized)).toEqual(payload)
  })

  it('requires structured-data script sites to use the shared safe serializer', () => {
    const appRoot = path.resolve(process.cwd(), 'app')
    const offenders: string[] = []

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (entry.isFile() && /\.(tsx|ts)$/.test(entry.name)) {
          const text = fs.readFileSync(full, 'utf8')
          if (text.includes('dangerouslySetInnerHTML') && text.includes('JSON.stringify(')) {
            offenders.push(path.relative(process.cwd(), full))
          }
        }
      }
    }

    walk(appRoot)
    expect(offenders, `Unsafe JSON-LD serialization remains in:\n${offenders.join('\n')}`).toEqual([])
  })
})
