'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { MilitaryDatasetStatus } from '@/lib/onet-military-dataset-v33'
import type { MilitaryLaneDraft, MilitarySourcingHypothesis } from '@/lib/military-talent-intelligence-v33'
import { militaryTalentGate, type MilitaryTalentGate } from '@/lib/military-role-gating-v33'
import type { OnetRoleIntelligence } from '@/lib/onet-role-intelligence'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

type MilitaryResponse = {
  ok?: boolean
  error?: string
  gate?: MilitaryTalentGate
  dataset?: MilitaryDatasetStatus | null
  hypothesis?: MilitarySourcingHypothesis
  drafts?: MilitaryLaneDraft[]
}

type OnetResponse = { ok?: boolean; intelligence?: OnetRoleIntelligence }

type RoleIntelligenceValue = {
  onet?: OnetRoleIntelligence
  military?: MilitarySourcingHypothesis
  militaryDrafts: MilitaryLaneDraft[]
  militaryDataset?: MilitaryDatasetStatus | null
  militaryGate?: MilitaryTalentGate
  militaryApproved: boolean
  loading: boolean
  error: string
}

const RoleIntelligenceContext = createContext<RoleIntelligenceValue | null>(null)

export function RoleIntelligenceProviderV33({ roleId, children }: { roleId: string; children: ReactNode }) {
  const { roles } = useRoleWorkspaces()
  const role = useMemo(() => roles.find(item => item.id === roleId), [roles, roleId])
  const [onet, setOnet] = useState<OnetRoleIntelligence | undefined>()
  const [military, setMilitary] = useState<MilitarySourcingHypothesis | undefined>()
  const [militaryDrafts, setMilitaryDrafts] = useState<MilitaryLaneDraft[]>([])
  const [militaryDataset, setMilitaryDataset] = useState<MilitaryDatasetStatus | null | undefined>()
  const [militaryGateState, setMilitaryGateState] = useState<MilitaryTalentGate | undefined>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const militaryApproved = Boolean(role?.searchLanes.some(lane => lane.id === 'military_transition' && lane.status === 'approved'))

  const intakeKey = role ? JSON.stringify({
    title: role.intake.title,
    location: role.intake.location,
    workMode: role.intake.workMode,
    compensation: role.intake.compensation,
    clearance: role.intake.clearance,
    mustHaves: role.intake.mustHaves,
    niceToHaves: role.intake.niceToHaves,
    disqualifiers: role.intake.disqualifiers,
    targetCompanies: role.intake.targetCompanies,
    adjacentBackgrounds: role.intake.adjacentBackgrounds,
    hiringManagerNotes: role.intake.hiringManagerNotes,
    rawDescription: role.intake.rawDescription,
  }) : ''

  useEffect(() => {
    if (!role || !intakeKey || !role.intake.title.trim() || role.intake.title === 'Untitled role') {
      setOnet(undefined); setMilitary(undefined); setMilitaryDrafts([]); setMilitaryDataset(undefined); setMilitaryGateState(undefined)
      return
    }

    const controller = new AbortController()
    const gate = militaryTalentGate(role.intake)
    setMilitaryGateState(gate)
    setLoading(true)
    setError('')

    void (async () => {
      try {
        const onetResponse = await fetch('/api/role-intelligence/onet', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: role.intake.title }),
          signal: controller.signal,
        })
        const onetJson = await onetResponse.json() as OnetResponse
        if (!onetResponse.ok || !onetJson.ok) throw new Error('O*NET role intelligence request failed.')
        setOnet(onetJson.intelligence)

        if (!gate.enabled) {
          setMilitary(undefined); setMilitaryDrafts([]); setMilitaryDataset(null)
          return
        }

        const militaryResponse = await fetch('/api/role-intelligence/military', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            intake: role.intake,
            ...(onetJson.intelligence?.matchedOccupation ? { onetOccupation: onetJson.intelligence.matchedOccupation } : {}),
          }),
          signal: controller.signal,
        })
        const militaryJson = await militaryResponse.json() as MilitaryResponse
        if (!militaryResponse.ok || !militaryJson.ok) throw new Error(militaryJson.error || 'Military role intelligence request failed.')
        setMilitaryGateState(militaryJson.gate || gate)
        setMilitaryDataset(militaryJson.dataset)
        setMilitary(militaryJson.hypothesis)
        setMilitaryDrafts(militaryJson.drafts || [])
      } catch (cause) {
        if ((cause as Error)?.name === 'AbortError') return
        setError(cause instanceof Error ? cause.message : 'Role intelligence failed.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    })()

    return () => controller.abort()
    // intakeKey is the stable, content-addressed dependency for role intelligence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intakeKey])

  const value = useMemo<RoleIntelligenceValue>(() => ({
    onet,
    military,
    militaryDrafts,
    militaryDataset,
    militaryGate: militaryGateState,
    militaryApproved,
    loading,
    error,
  }), [onet, military, militaryDrafts, militaryDataset, militaryGateState, militaryApproved, loading, error])

  return <RoleIntelligenceContext.Provider value={value}>{children}</RoleIntelligenceContext.Provider>
}

export function useRoleIntelligenceV33(): RoleIntelligenceValue {
  const value = useContext(RoleIntelligenceContext)
  if (!value) throw new Error('useRoleIntelligenceV33 must be used inside RoleIntelligenceProviderV33.')
  return value
}
