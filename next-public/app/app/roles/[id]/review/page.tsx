import { notFound } from 'next/navigation'
import { ReviewSessionV41 } from '@/components/ReviewSessionV41'

export const metadata = {
  title: 'Candidate Review | SourcingOS',
  robots: { index: false, follow: false },
}

export default async function CandidateReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const enabled = process.env.VERCEL_ENV === 'preview'
    || String(process.env.ENABLE_V41_REVIEW_SESSION || '').toLowerCase() === 'true'
  if (!enabled) notFound()

  const { id } = await params
  return <ReviewSessionV41 roleId={id} />
}
