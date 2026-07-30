import { IdentityReviewClient } from '@/components/IdentityReviewClient'

export const metadata = {
  title: 'Identity Review — SourcingOS',
  description: 'Review source-profile-to-candidate identity proposals, deterministic anchors, similarity components, provenance, and conflicts.',
  robots: { index: false, follow: false },
}

export default function IdentityReviewPage() {
  return <main className="wrap">
    <div className="product-page-head">
      <div>
        <span className="kicker">Candidate intelligence</span>
        <h1>Identity Review</h1>
        <p>Inspect proposed source-profile relationships with provenance and conflicts. This surface is read-only until attachment and duplicate cleanup are transactional and reversible.</p>
      </div>
    </div>
    <IdentityReviewClient />
  </main>
}
