import type { Metadata } from 'next'
import Link from 'next/link'
import { SearchExhaustionCalculatorClient } from '@/components/SearchExhaustionCalculatorClient'

export const metadata: Metadata = {
  title: 'Search Exhaustion Calculator for Recruiters | SourcingOS',
  description: 'Calculate lane coverage, duplicate rate, unique-query yield, donor-map coverage, adjacent-title yield, and recent sourcing yield before declaring a candidate market exhausted.',
  alternates: { canonical: '/tools/search-exhaustion-calculator/' },
  keywords: ['search exhaustion calculator','candidate market exhausted','sourcing coverage metrics','when to stop sourcing','candidate pool saturation'],
}

export default function SearchExhaustionCalculatorPage(){
 return <main className="wrap article">
  <span className="kicker">Free sourcing tool</span>
  <h1>Search Exhaustion Evidence Calculator</h1>
  <p className="lead">Replace “we looked everywhere” with visible coverage evidence. Calculate the metrics behind lane saturation, duplicate pressure, new-query contribution, donor-map coverage, and expansion yield—without pretending there is a universal magic cutoff.</p>
  <SearchExhaustionCalculatorClient />
  <section>
   <h2>What this calculator is for</h2>
   <p>Use it before a hiring-manager calibration or stop/continue decision. The output is a set of transparent ratios and open questions. It is not an empirically validated hiring algorithm and it does not make a requisition decision for you.</p>
   <p>Read the full <Link href="/blog/search-exhaustion-framework/">Search-Lane Exhaustion methodology</Link>, then use the <Link href="/tools/search-lane-expander/">Search Lane Expander</Link> if the evidence shows meaningful lanes are still open.</p>
  </section>
 </main>
}
