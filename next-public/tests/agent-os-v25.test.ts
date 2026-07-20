import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '..')
const sql = fs.readFileSync(path.join(root, 'sql/agent-os-v23-v25.sql'), 'utf8')
const api = fs.readFileSync(path.join(root, 'app/api/agent-os/route.ts'), 'utf8')
const engine = fs.readFileSync(path.join(root, 'lib/agent-os-v25.ts'), 'utf8')

describe('V23-V25 Agent OS', () => {
  it('creates durable orchestration, approval, memory, graph, and brief tables', () => {
    for (const table of ['agent_workflows','agent_steps','agent_approvals','recruiter_memory_signals','talent_graph_edges','recruiter_daily_briefs']) {
      expect(sql).toContain(`create table if not exists public.${table}`)
      expect(sql).toContain(`alter table public.${table} enable row level security`)
    }
  })

  it('keeps writes server-controlled and owner scoped', () => {
    expect(sql).toContain('revoke all on public.agent_workflows')
    expect(sql).toContain('owner_id = auth.uid()')
    expect(api).toContain("requireSession()")
    expect(api).toContain("eq('owner_id', gate.userId)")
  })

  it('requires recruiter approval for strategy and calibration', () => {
    expect(engine).toContain("{ key: 'strategy', agent: 'sourcing_strategist', approval: true }")
    expect(engine).toContain("{ key: 'calibration', agent: 'memory_analyst', approval: true }")
    expect(engine).toContain("No automatic outreach")
    expect(engine).toContain("Ambiguous identities require review")
  })

  it('uses resumable deterministic checkpoints', () => {
    expect(engine).toContain('ROLE_LAUNCH_STEPS')
    expect(engine).toContain('advanceWorkflow')
    expect(engine).toContain("status: 'waiting_approval'")
    expect(engine).toContain("status: 'completed'")
  })
})
