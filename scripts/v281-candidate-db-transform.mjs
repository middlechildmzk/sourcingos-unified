import fs from 'node:fs'

const path = 'next-public/components/CandidateDbClient.tsx'
let text = fs.readFileSync(path, 'utf8')

function replaceOnce(search, replacement, label) {
  if (!text.includes(search)) {
    if (text.includes(replacement)) return
    throw new Error(`Missing Candidate DB transform marker: ${label}`)
  }
  text = text.replace(search, replacement)
}

replaceOnce(
  "import { useRouter } from 'next/navigation'\n",
  '',
  'router import',
)

replaceOnce(
  "  const router = useRouter()\n",
  '',
  'router instance',
)

replaceOnce(
`              return <div
                className="product-row candidate-db-row"
                key={candidate.id}
                role="button"
                tabIndex={0}
                aria-label={\`Open \${candidate.canonicalName} in Candidate 360\`}
                onClick={event => {
                  const target = event.target as HTMLElement
                  if (target.closest('button,a,input,select')) return
                  router.push(href)
                }}
                onKeyDown={event => {
                  if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
                    event.preventDefault()
                    router.push(href)
                  }
                }}
              >
                <div className="product-row-main">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Link className="product-row-title candidate-row-link" href={href}>{candidate.canonicalName}</Link>`,
`              return <div className="product-row candidate-db-row" key={candidate.id}>
                <Link
                  className="candidate-row-open-surface"
                  href={href}
                  aria-label={\`Open \${candidate.canonicalName} in Candidate 360\`}
                />
                <div className="product-row-main">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="product-row-title candidate-row-link">{candidate.canonicalName}</span>`,
  'candidate row semantics',
)

fs.writeFileSync(path, text)
console.log('Applied semantic Candidate DB row transformation')
