import fs from 'node:fs'

const path = 'next-public/components/CandidateDrawer.tsx'
let text = fs.readFileSync(path, 'utf8')

text = text.replace(
  /(?:import \{ canPromoteToCandidate, entityKindLabels \} from '@\/lib\/entity-classification'\n)+/,
  "import { canPromoteToCandidate, entityKindLabels } from '@/lib/entity-classification'\n",
)

text = text.replace(
  /(?:  const entityKind = result\.entityKind \?\? 'unknown'\n  const canSaveCandidate = canPromoteToCandidate\(entityKind\)\n)+/,
  "  const entityKind = result.entityKind ?? 'unknown'\n  const canSaveCandidate = canPromoteToCandidate(entityKind)\n",
)

const importCount = (text.match(/import \{ canPromoteToCandidate, entityKindLabels \}/g) || []).length
const declarationCount = (text.match(/const canSaveCandidate =/g) || []).length
if (importCount !== 1 || declarationCount !== 1) {
  throw new Error(`Candidate Drawer cleanup failed: imports=${importCount}, declarations=${declarationCount}`)
}

fs.writeFileSync(path, text)
console.log('Candidate Drawer duplicate transform artifacts removed')
