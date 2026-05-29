import Link from 'next/link'
import { publicNav, requestAccessCTA } from '@/data/nav'

export function Nav() {
  return (
    <header className="nav">
      <Link className="brand" href="/">SourcingOS</Link>
      <nav>
        {publicNav.map(item => (
          <Link key={item.href} href={item.href}>{item.label}</Link>
        ))}
        <Link href={requestAccessCTA.href} className="pill">{requestAccessCTA.label}</Link>
      </nav>
    </header>
  )
}
