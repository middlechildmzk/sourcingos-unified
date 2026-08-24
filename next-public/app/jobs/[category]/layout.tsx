import type { ReactNode } from 'react'
import { JobAlertSignup } from '@/components/JobAlertSignup'
import { getCategoryBySlug } from '@/data/jobs'

export default function JobCategoryLayout({
  children,
  params,
}: {
  children: ReactNode
  params: { category: string }
}) {
  const category = getCategoryBySlug(params.category)
  const location = params.category.startsWith('remote-') ? 'Remote' : ''
  const alertsEnabled = process.env.JOB_ALERTS_ENABLED === 'true'

  return (
    <>
      {children}
      {category && alertsEnabled ? (
        <section className="wrap">
          <JobAlertSignup
            category={params.category}
            categoryName={category.name}
            query={category.name}
            location={location}
          />
        </section>
      ) : null}
    </>
  )
}
