import Link from 'next/link'

export function Nav() {
  return <header className="nav">
    <Link className="brand" href="/">SourcingOS</Link>
    <nav>
      <Link href="/tools">Free Tools</Link>
      <Link href="/methods">Sourcing Vault</Link>
      <Link href="/sources">Candidate Graph</Link>
      <Link href="/directory">Directory</Link>
      <Link href="/blog">Guides</Link>
      <Link href="/waitlist" className="pill">Request access</Link>
    </nav>
  </header>
}
