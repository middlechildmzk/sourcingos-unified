import Link from 'next/link'

export function Nav() {
  return <header className="nav">
    <Link className="brand" href="/">SourcingOS</Link>
    <nav>
      <Link href="/tools">Tools</Link>
      <Link href="/sources">Sources</Link>
      <Link href="/methods">Methods</Link>
      <Link href="/directory">Directory</Link>
      <Link href="/blog">Guides</Link>
      <Link href="/comparisons">Comparisons</Link>
      <Link href="/waitlist" className="pill">Join beta</Link>
    </nav>
  </header>
}
