import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '..')
const roleReviewSurfaces = [
  'components/RoleDetailClient.tsx',
  'components/CandidateReviewPro.tsx',
  'components/RoleCalibrationPanel.tsx',
  'components/RoleCandidateEvidenceMatrix.tsx',
  'components/RoleCandidateEvidenceAnalysisClient.tsx',
]

function read(file: string): string {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

describe('V32 candidate qualification score retirement', () => {
  it('keeps the retired 0-100 review score out of every role-review surface', () => {
    for (const file of roleReviewSurfaces) {
      const source = read(file)
      expect(source, file).not.toContain('candidateReviewScore')
      expect(source, file).not.toContain('matchedRoleSignals')
      expect(source, file).not.toContain('Review score')
    }
  })

  it('does not route the separate lib/ai fitScore contract into role evaluation', () => {
    for (const file of roleReviewSurfaces) {
      const source = read(file)
      expect(source, file).not.toContain("@/lib/ai")
      expect(source, file).not.toContain('fitScore')
    }
  })

  it('keeps Candidate 360 explicitly score-free and evidence-decomposable', () => {
    const matrix = read('components/RoleCandidateEvidenceMatrix.tsx')
    expect(matrix).toContain('No fit score')
    expect(matrix).toContain('Requirement evidence matrix')
    expect(matrix).toContain("state === 'supported'")
    expect(matrix).toContain("state === 'needs_verification'")
    expect(matrix).toContain("state === 'contradicted'")
    expect(matrix).toContain('Unknown')
    expect(matrix).toContain('Exact stored source span')
  })
})
