import fs from 'node:fs'

const path = 'next-public/lib/source-connectors.ts'
let text = fs.readFileSync(path, 'utf8')

function insertKind(source, expression) {
  const multiline = new RegExp(`source: '${source}',\\n(\\s+)sourceProfileId:`)
  if (multiline.test(text)) {
    text = text.replace(multiline, `source: '${source}',\n$1entityKind: ${expression},\n$1sourceProfileId:`)
    return
  }

  const inline = new RegExp(`source: '${source}', sourceProfileId:`)
  if (inline.test(text)) {
    text = text.replace(inline, `source: '${source}', entityKind: ${expression}, sourceProfileId:`)
    return
  }

  const already = new RegExp(`source: '${source}',(?:\\n| )[^}]{0,160}entityKind:`)
  if (!already.test(text)) throw new Error(`Could not add entityKind for ${source}`)
}

insertKind('github', "detail?.type === 'Organization' ? 'organization' : detail?.type === 'User' ? 'person' : 'unknown'")
insertKind('stackoverflow', "'person'")
insertKind('openalex', "'person'")
insertKind('npi', "safe(r.enumeration_type).toUpperCase() === 'NPI-2' || Boolean(basic.organization_name) ? 'organization' : safe(r.enumeration_type).toUpperCase() === 'NPI-1' || Boolean(basic.first_name || basic.last_name) ? 'person' : 'unknown'")
insertKind('orcid', "'person'")
insertKind('semantic_scholar', "'person'")
insertKind('arxiv', "'person'")
insertKind('pubmed', "'person'")
insertKind('huggingface', "'artifact'")
insertKind('npm', "'artifact'")
insertKind('pypi', "'artifact'")
insertKind('kaggle', "'search_lane'")
insertKind('devto', "'unknown'")
insertKind('dockerhub', "'artifact'")
insertKind('crates', "'artifact'")
insertKind('rubygems', "'artifact'")
insertKind('resume_xray', "'search_lane'")

const resultKindCount = (text.match(/entityKind:/g) || []).length
if (resultKindCount < 17) throw new Error(`Expected at least 17 connector entity kinds, found ${resultKindCount}`)

fs.writeFileSync(path, text)
console.log(`Added explicit entity kinds to connector results (${resultKindCount})`)
