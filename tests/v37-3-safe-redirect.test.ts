import { describe, expect, it } from 'vitest'
import { safeRelativePath } from '../lib/safe-redirect'

describe('V37.3 safe redirect hardening', () => {
  it('keeps normal app-relative destinations', () => {
    expect(safeRelativePath('/app/search?role=abc#results')).toBe('/app/search?role=abc#results')
    expect(safeRelativePath('/app/today')).toBe('/app/today')
  })

  it('falls back for absolute, protocol-relative, backslash and encoded separator destinations', () => {
    const fallback = '/app/search'
    expect(safeRelativePath('https://evil.example')).toBe(fallback)
    expect(safeRelativePath('//evil.example')).toBe(fallback)
    expect(safeRelativePath('/\\evil.example')).toBe(fallback)
    expect(safeRelativePath('/%5Cevil.example')).toBe(fallback)
    expect(safeRelativePath('/%2Fevil.example')).toBe(fallback)
    expect(safeRelativePath('/app/%2F%2Fevil.example')).toBe(fallback)
  })

  it('uses canonical People Search when no safe destination exists', () => {
    expect(safeRelativePath(undefined)).toBe('/app/search')
  })
})
