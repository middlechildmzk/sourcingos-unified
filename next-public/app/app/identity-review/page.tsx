import Link from 'next/link'
import { IdentityReviewInboxV36_10 } from '@/components/IdentityReviewInboxV36_10'

export const metadata = {
  title: 'Identity Review — SourcingOS',
  description: 'Review cross-source identity proposals before attaching source observations to a canonical Candidate 360.',
  robots: { index: false, follow: false },
}

export default function IdentityReviewPage() {
  return <main className="wrap">
    <div className="product-page-head">
      <div>
        <span className="kicker">Candidate Graph · V36.10</span>
        <h1>Identity Review</h1>
        <p>Resolve likely duplicate person observations without losing source provenance. Similarity ranks review; only your explicit confirmation links records.</p>
      </div>
      <div className="product-page-actions">
        <Link className="btn ghost" href="/app/candidate-database">Candidate database</Link>
        <Link className="btn secondary" href="/app/candidate-search">Find people</Link>
      </div>
    </div>
    <IdentityReviewInboxV36_10 />
  </main>
}
