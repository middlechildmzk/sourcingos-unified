'use client'
import { useMemo, useState } from 'react'
import { trackClientEvent } from '@/lib/analytics'

// ─────────────────────────────────────────────────────────────────────────────
// Aging Req Rescue Planner — deterministic, client-only. No AI, no API.
// Inputs: req age, lanes tried, response rate, HM flexibility, submittals.
// Output: a primary diagnosis + rescue checklist + HM conversation note.
// Rules are explicit heuristics a senior sourcer would apply, not a model.
// ─────────────────────────────────────────────────────────────────────────────

const LANES = ['LinkedIn Recruiter', 'ClearanceJobs', 'Job boards (Indeed/Dice)', 'GitHub / open web', 'Referrals', 'ATS rediscovery', 'Communities / events'] as const

type Diagnosis = {
  key: string
  label: string
  why: string
  fix: string[]
  hmNote: string
}

function diagnose(input: {
  ageDays: number
  lanesTried: number
  responseRate: 'none' | 'low' | 'ok'
  replied: boolean
  submittals: number
  hmFlexible: 'rigid' | 'some' | 'open'
}): { primary: Diagnosis; secondary: Diagnosis[] } {
  const D: Record<string, Diagnosis> = {
    ghost: {
      key: 'ghost', label: 'Possible ghost / deprioritized req',
      why: 'The req is old and very few lanes have been worked, which often means the role lost urgency internally before sourcing ever got traction.',
      fix: ['Confirm with the HM in writing that the role is still active and funded.', 'Ask what changed since open — backfill, reorg, budget?', 'Get a refreshed close-by date or agree to pause it.'],
      hmNote: 'Before I invest another sprint, can you confirm this is still a priority hire and the scope hasn\u2019t shifted? I want to make sure we\u2019re both spending effort on a live req.',
    },
    laneExhaustion: {
      key: 'laneExhaustion', label: 'Lane exhaustion',
      why: 'Several lanes are already worked but the role is aging — you\u2019re re-touching the same finite pool instead of opening new supply.',
      fix: ['Add 2 lanes you haven\u2019t used (open-web/GitHub, communities, ATS rediscovery).', 'Rebuild the Boolean as an Expanded / Market Map lane to reach adjacent profiles.', 'Map 5 competitor/donor companies and source by employer, not title.'],
      hmNote: 'I\u2019ve worked the obvious lanes. To find the people we\u2019re missing I want to widen to adjacent titles and competitor companies \u2014 which means some profiles won\u2019t match the JD line-for-line. Can we align on what\u2019s truly must-have?',
    },
    calibration: {
      key: 'calibration', label: 'Calibration drift',
      why: 'You\u2019re getting candidates and even replies, but submittals aren\u2019t converting \u2014 the search and the HM\u2019s real bar are out of sync.',
      fix: ['Send the HM 3\u20135 anonymized profiles: "which is closest, and why?"', 'Turn the answer into a revised must-have / nice-to-have list.', 'Re-run the Balanced lane against the corrected bar.'],
      hmNote: 'I\u2019m getting candidates but I want to make sure they\u2019re the right shape. I\u2019ll send 4 profiles \u2014 can you tell me which is closest and what specifically makes the others a miss? That calibrates the rest of the search.',
    },
    comp: {
      key: 'comp', label: 'Comp / location mismatch',
      why: 'Outreach is going out but responses are scarce \u2014 a classic signal that the package, location, or onsite requirement is below market for the skill set.',
      fix: ['Pull a market comp reality check for the title + location.', 'Confirm the band and remote/onsite flexibility with the HM/recruiter.', 'If fixed, target candidates for whom this comp/location is a step up, not a cut.'],
      hmNote: 'Response rate suggests our comp or location terms may be under market for this skill set. Can we confirm the band and whether there\u2019s any remote/onsite flexibility before I keep pushing the same message?',
    },
    outreach: {
      key: 'outreach', label: 'Outreach / messaging problem',
      why: 'You\u2019re reaching people but they\u2019re not replying \u2014 with comp ruled out, the message itself is usually the bottleneck.',
      fix: ['Rewrite the first touch: lead with why them specifically (evidence), not the company pitch.', 'Add a 3-touch sequence; most replies come on touch 2\u20133.', 'A/B the subject line on the next 20 sends.'],
      hmNote: 'I\u2019m reaching the right people but reply rate is low. I\u2019m reworking the outreach to be more specific and adding follow-ups \u2014 no change needed on your side yet; flagging so you know why timing may shift.',
    },
    earlyStage: {
      key: 'earlyStage', label: 'Too early to rescue \u2014 keep executing',
      why: 'The req isn\u2019t actually aged yet or hasn\u2019t had enough lanes worked. The fix is volume and a couple more lanes, not a rescue intervention.',
      fix: ['Work 2\u20133 more lanes before changing strategy.', 'Hit a meaningful outreach volume before judging response rate.', 'Re-evaluate at the 3\u20134 week mark.'],
      hmNote: 'We\u2019re still in the normal sourcing window for this role. I\u2019ll keep working lanes and check back with a pipeline read shortly.',
    },
  }

  const scores: Record<string, number> = { ghost: 0, laneExhaustion: 0, calibration: 0, comp: 0, outreach: 0, earlyStage: 0 }

  if (input.ageDays >= 30) { scores.laneExhaustion += 1; scores.ghost += 1 }
  if (input.ageDays >= 45) { scores.ghost += 1 }
  if (input.ageDays < 14) { scores.earlyStage += 2 }
  if (input.lanesTried <= 2) { scores.earlyStage += 1; if (input.ageDays >= 30) scores.ghost += 1 }
  if (input.lanesTried >= 4) { scores.laneExhaustion += 2 }
  if (input.responseRate === 'none') { scores.comp += 2; scores.outreach += 1 }
  if (input.responseRate === 'low') { scores.outreach += 2; scores.comp += 1 }
  if (input.replied && input.submittals > 0) { scores.calibration += 3 }
  if (input.replied && input.submittals === 0) { scores.outreach += 1 }
  if (input.hmFlexible === 'rigid') { scores.calibration += 1; scores.comp += 1 }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const primaryKey = ranked[0][1] === 0 ? 'earlyStage' : ranked[0][0]
  const secondaryKeys = ranked.filter(([k, v]) => v > 0 && k !== primaryKey).slice(0, 2).map(([k]) => k)
  return { primary: D[primaryKey], secondary: secondaryKeys.map(k => D[k]) }
}

export function AgingReqRescueTool() {
  const [ageDays, setAgeDays] = useState(38)
  const [lanes, setLanes] = useState<string[]>(['LinkedIn Recruiter', 'Job boards (Indeed/Dice)'])
  const [responseRate, setResponseRate] = useState<'none' | 'low' | 'ok'>('low')
  const [replied, setReplied] = useState(true)
  const [submittals, setSubmittals] = useState(2)
  const [hmFlexible, setHmFlexible] = useState<'rigid' | 'some' | 'open'>('some')

  const result = useMemo(() => diagnose({ ageDays, lanesTried: lanes.length, responseRate, replied, submittals, hmFlexible }), [ageDays, lanes, responseRate, replied, submittals, hmFlexible])

  function toggleLane(l: string) {
    setLanes(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l])
    trackClientEvent('aging_req_lane', l)
  }

  return (
    <div className="interactive-tool">
      <div className="form-grid" style={{ display: 'grid', gap: 16 }}>
        <div>
          <label>Days the req has been open: <strong>{ageDays}</strong></label>
          <input type="range" min={1} max={120} value={ageDays} onChange={e => setAgeDays(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
        <div>
          <label>Lanes already worked ({lanes.length})</label>
          <div className="mode-row" style={{ flexWrap: 'wrap' }}>
            {LANES.map(l => <button key={l} className={lanes.includes(l) ? 'active' : ''} onClick={() => toggleLane(l)}>{l}</button>)}
          </div>
        </div>
        <div>
          <label>Outreach response rate</label>
          <div className="mode-row">
            {(['none', 'low', 'ok'] as const).map(r => <button key={r} className={r === responseRate ? 'active' : ''} onClick={() => setResponseRate(r)}>{r === 'none' ? 'No replies' : r === 'low' ? 'Low' : 'OK / normal'}</button>)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <label>Candidates submitted to HM</label>
            <input className="input" type="number" min={0} max={99} value={submittals} onChange={e => setSubmittals(Number(e.target.value))} style={{ width: 90 }} />
          </div>
          <div>
            <label style={{ display: 'block' }}>Any replies yet?</label>
            <label style={{ fontSize: 13 }}><input type="checkbox" checked={replied} onChange={e => setReplied(e.target.checked)} /> Yes, at least some</label>
          </div>
          <div>
            <label>HM flexibility on the bar</label>
            <div className="mode-row">
              {(['rigid', 'some', 'open'] as const).map(h => <button key={h} className={h === hmFlexible ? 'active' : ''} onClick={() => setHmFlexible(h)}>{h}</button>)}
            </div>
          </div>
        </div>
      </div>

      <div className="results" style={{ marginTop: 20 }}>
        <div className="result-card">
          <span className="kicker">Primary diagnosis</span>
          <h3 style={{ margin: '4px 0' }}>{result.primary.label}</h3>
          <p className="muted">{result.primary.why}</p>
          <div style={{ marginTop: 10 }}>
            <span className="kicker">Rescue plan</span>
            <ul style={{ fontSize: 14, margin: '6px 0', paddingLeft: 18 }}>{result.primary.fix.map(f => <li key={f}>{f}</li>)}</ul>
          </div>
          <div style={{ marginTop: 10 }}>
            <span className="kicker">Hiring-manager note (copy &amp; adapt)</span>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{result.primary.hmNote}</pre>
            <div className="button-row"><button onClick={() => { navigator.clipboard?.writeText(result.primary.hmNote); trackClientEvent('copy_hm_note', result.primary.key) }}>Copy HM note</button></div>
          </div>
        </div>

        {result.secondary.length > 0 && (
          <div className="result-card">
            <span className="kicker">Also worth checking</span>
            {result.secondary.map(s => (
              <div key={s.key} style={{ marginTop: 8 }}>
                <strong>{s.label}</strong>
                <p className="muted" style={{ fontSize: 13, margin: '2px 0' }}>{s.why}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="cta" style={{ fontSize: 13, marginTop: 14 }}>
        This is a structured diagnostic, not a verdict. It applies common senior-sourcer heuristics
        to the inputs you gave — confirm the real cause with the hiring team before acting. Comp,
        clearance, and scope decisions belong to the hiring manager.
      </div>
    </div>
  )
}
