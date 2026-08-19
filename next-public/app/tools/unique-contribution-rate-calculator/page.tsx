import type { Metadata } from 'next'
import Link from 'next/link'
import { UniqueContributionRateCalculatorClient } from '@/components/UniqueContributionRateCalculatorClient'

const fullDefinition = 'Unique Contribution Rate (UCR) is the percentage of evidence-fit leads surfaced by a source that were not surfaced by the comparison source stack in the same requisition-level test.'
const bridge = 'An evidence-fit lead is a lead the recruiter actually reviewed against the same job-relevant standard used for every other source in the test. Appearing in an unreviewed result list does not qualify.'

export const metadata: Metadata = {
  title: 'Unique Contribution Rate Calculator for Sourcing Channels | SourcingOS',
  description: 'Calculate UCR: the share of a source’s evidence-fit leads that no other tested source surfaced. Compare additive discovery and source-stack overlap on the same requisition-level test.',
  alternates: { canonical: '/tools/unique-contribution-rate-calculator/' },
  keywords: ['sourcing channel effectiveness','unique contribution rate recruiting','candidate source overlap','source of hire metrics','sourcing analytics calculator'],
  openGraph: {
    title: 'Unique Contribution Rate Calculator for Sourcing Channels | SourcingOS',
    description: 'Measure additive discovery and source-stack overlap using one consistent evidence-fit review standard.',
    url: '/tools/unique-contribution-rate-calculator/',
    type: 'website',
  },
}

export default function UniqueContributionRateCalculatorPage(){
 return <main className="wrap article">
  <span className="kicker">Free sourcing analytics tool</span>
  <h1>Unique Contribution Rate Calculator</h1>
  <p className="lead">{fullDefinition}</p>
  <p>{bridge}</p>
  <UniqueContributionRateCalculatorClient />
  <section>
   <h2>The formula</h2>
   <pre>UCR(source) = evidence-fit leads unique to that source / evidence-fit leads surfaced by that source</pre>
   <p>Use the same evidence-fit definition across sources. Read the <Link href="/blog/unique-contribution-rate/">full methodology and test protocol</Link> before presenting results to leadership.</p>
  </section>
 </main>
}
