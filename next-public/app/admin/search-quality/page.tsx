import { redirect } from 'next/navigation'
import { getSession } from '@/lib/supabase/session'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { SEARCH_BENCHMARK_CORPUS_V38, SEARCH_BENCHMARK_FAMILIES_V38 } from '@/lib/search-quality/benchmark-corpus-v38'

export const metadata = { title: 'Search Quality · SourcingOS Admin', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

type RunRow = {
  id: string
  created_at?: string
  canonical_role_key?: string | null
  query?: string | null
  metrics?: Record<string, unknown> | null
  provider_telemetry?: unknown[] | null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function number(value: unknown): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

async function recentRuns(): Promise<{ rows: RunRow[]; error?: string }> {
  if (!isSupabaseConfigured()) return { rows: [], error: 'Search-quality storage is not configured in this environment.' }
  const sb = createServerSupabaseClient()
  if (!sb) return { rows: [], error: 'Search-quality storage client is unavailable.' }
  try {
    const { data, error } = await sb.from('search_quality_runs')
      .select('id,created_at,canonical_role_key,query,metrics,provider_telemetry')
      .order('created_at', { ascending: false })
      .limit(25)
    if (error) return { rows: [], error: error.message }
    return { rows: (data || []) as RunRow[] }
  } catch {
    return { rows: [], error: 'Recent search-quality runs could not be loaded.' }
  }
}

export default async function SearchQualityAdminPage() {
  const session = await getSession()
  if (session.mode === 'preview') redirect('/login?from=/admin/search-quality')
  if (!session.authenticated) redirect('/login?from=/admin/search-quality')
  if (session.user.role !== 'admin') redirect('/app/search')

  const recent = await recentRuns()
  return <main className="wrap">
    <div className="eyebrow">V38 evaluation</div>
    <h1>Search Quality + Provider Reliability</h1>
    <p className="lead">Release evidence for recruiter interpretation, provider runtime health, retrieval admission and trust boundaries. Metrics here diagnose search; they are never candidate fit scores.</p>

    <section className="card" style={{ marginTop: 18 }}>
      <h2>Golden benchmark corpus</h2>
      <p>{SEARCH_BENCHMARK_CORPUS_V38.length} recruiter-reviewed scenarios across {SEARCH_BENCHMARK_FAMILIES_V38.length} talent families. Candidate relevance labels are added only after human review of actual observations.</p>
      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        {SEARCH_BENCHMARK_CORPUS_V38.map(item => <details key={item.id} style={{ borderTop: '1px solid rgba(127,127,127,.2)', paddingTop: 8 }}>
          <summary style={{ cursor: 'pointer' }}><strong>{item.label}</strong> <small>· {item.family.replaceAll('_', ' ')}</small></summary>
          <p><b>Query:</b> {item.query}</p>
          <p><b>Must have:</b> {item.expected.mustHave.join(' · ')}</p>
          {!!item.expected.discoveryOnly?.length && <p><b>Search-only expansion:</b> {item.expected.discoveryOnly.join(' · ')}</p>}
          {!!item.expected.neverInfer?.length && <p><b>Never infer:</b> {item.expected.neverInfer.join(' · ')}</p>}
        </details>)}
      </div>
    </section>

    <section className="card" style={{ marginTop: 18 }}>
      <h2>Recent runtime evidence</h2>
      {recent.error && <p>{recent.error}</p>}
      {!recent.error && !recent.rows.length && <p>No persisted search-quality runs yet.</p>}
      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        {recent.rows.map(row => {
          const metrics = asRecord(row.metrics)
          const v38 = asRecord(metrics.v38)
          const funnel = asRecord(v38.funnel)
          const summary = asRecord(v38.providerSummary)
          return <details key={row.id} style={{ borderTop: '1px solid rgba(127,127,127,.2)', paddingTop: 8 }}>
            <summary style={{ cursor: 'pointer' }}>
              <strong>{row.canonical_role_key || 'ad hoc search'}</strong>
              <small> · {row.created_at ? new Date(row.created_at).toLocaleString() : 'unknown time'}</small>
            </summary>
            <p>{row.query || 'Query unavailable'}</p>
            <p><b>Funnel:</b> {number(funnel.rawDiscoveries || metrics.rawObservations)} discovered → {number(funnel.relevanceAdmitted)} admitted → {number(funnel.finalRetained || metrics.retainedObservations)} retained</p>
            <p><b>Provider health:</b> {number(summary.successful)} successful · {number(summary.zeroResults)} zero-result · {number(summary.degraded)} degraded · {number(summary.unavailable)} unavailable · {number(summary.failed)} failed</p>
            <p><b>Trust:</b> provider retrieval remains separate from qualification; missing evidence remains unknown.</p>
          </details>
        })}
      </div>
    </section>
  </main>
}
