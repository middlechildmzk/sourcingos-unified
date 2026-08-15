import type { Metadata } from 'next'
import Link from 'next/link'
import { UniqueContributionRateCalculatorClient } from '@/components/UniqueContributionRateCalculatorClient'

export const metadata: Metadata = {
  title: 'Unique Contribution Rate Calculator for Sourcing Channels | SourcingOS',
  description: 'Measure what each recruiting source uniquely adds to a controlled search. Calculate unique contribution rate and optional cost per unique candidate without confusing additive discovery with source of hire.',
  alternates: { canonical: '/tools/unique-contribution-rate-calculator/' },
  keywords: ['sourcing channel effectiveness','unique contribution rate recruiting','candidate source overlap','source of hire metrics','sourcing analytics calculator'],
}

export default function UniqueContributionRateCalculatorPage(){
 return <main className="wrap article">
  <span className="kicker">Free sourcing analytics tool</span>
  <h1>Unique Contribution Rate Calculator</h1>
  <p className="lead">Measure what each source or search lane adds that the others did not surface in the same controlled comparison. UCR is useful for overlap and stack decisions; it is not a stand-alone quality or ROI score.</p>
  <UniqueContributionRateCalculatorClient />
  <section>
   <h2>The formula</h2>
   <pre>UCR(source) = candidates unique to that source / reviewed candidates surfaced by that source</pre>
   <p>The denominator must use the same review definition across sources. Read the <Link href="/blog/unique-contribution-rate/">full methodology and test protocol</Link> before presenting results to leadership.</p>
  </section>
 </main>
}
