import type { ReactNode } from 'react'
import { JobAlertSignup } from '@/components/JobAlertSignup'
import { getCategoryBySlug } from '@/data/jobs'

export default async function JobCategoryLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ category: string }>
}) {
  const { category: categorySlug } = await params
  const category = getCategoryBySlug(categorySlug)
  const location = categorySlug.startsWith('remote-') ? 'Remote' : ''
  // Emergency kill switch: set JOB_ALERTS_ENABLED=false to hide the form.
  // Production defaults on because the persistence migration is now applied.
  const alertsEnabled = process.env.JOB_ALERTS_ENABLED !== 'false'

  return (
    <>
      {children}
      {category && alertsEnabled ? (
        <section className="wrap">
          <JobAlertSignup
            category={categorySlug}
            categoryName={category.name}
            query={category.name}
            location={location}
          />
        </section>
      ) : null}
    </>
  )
}
