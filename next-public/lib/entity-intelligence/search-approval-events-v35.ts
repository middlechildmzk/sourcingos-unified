import type { RoleActivity } from '@/lib/role-workspace'
import { entityByIdV35 } from './registry-v35'
import {
  setApprovedSearchEntityV35,
  type RoleSearchIntelligenceStateV35,
} from './search-approval-v35'

const EVENT_PREFIX = 'v35si'

type SearchEventAction = 'a' | 'r' | 'c'
type ParsedSearchEvent = { action: SearchEventAction; entityId: string; createdAt: string }

function activityId(action: SearchEventAction, entityId: string, now: Date): string {
  const encoded = encodeURIComponent(entityId).slice(0, 72)
  return `${EVENT_PREFIX}|1|${action}|${encoded}|${now.getTime()}`.slice(0, 120)
}

export function searchIntelligenceActivityEventV35(
  entityId: string,
  entityLabel: string,
  approved: boolean,
  now = new Date(),
): RoleActivity {
  return {
    id: activityId(approved ? 'a' : 'r', entityId, now),
    type: 'search_intelligence_updated',
    message: `${approved ? 'Approved' : 'Removed'} search expansion: ${entityLabel}. This changes retrieval only, not role requirements.`,
    createdAt: now.toISOString(),
  }
}

export function clearSearchIntelligenceActivityEventV35(now = new Date()): RoleActivity {
  return {
    id: activityId('c', 'all', now),
    type: 'search_intelligence_updated',
    message: 'Cleared recruiter-approved search expansions. Approved Role Brief criteria were unchanged.',
    createdAt: now.toISOString(),
  }
}

function parseSearchEvent(activity: RoleActivity): ParsedSearchEvent | undefined {
  if (activity.type !== 'search_intelligence_updated' || !activity.id.startsWith(`${EVENT_PREFIX}|1|`)) return undefined
  const [prefix, version, action, encoded] = activity.id.split('|')
  if (prefix !== EVENT_PREFIX || version !== '1' || !['a', 'r', 'c'].includes(action)) return undefined
  let entityId = ''
  try { entityId = decodeURIComponent(encoded || '') } catch { return undefined }
  if (action !== 'c' && !entityByIdV35(entityId)) return undefined
  return { action: action as SearchEventAction, entityId, createdAt: activity.createdAt }
}

/** Rebuild current approved retrieval expansion state from durable role activity. */
export function deriveRoleSearchIntelligenceFromActivityV35(
  activity: RoleActivity[],
): RoleSearchIntelligenceStateV35 | undefined {
  const events = activity
    .map(parseSearchEvent)
    .filter((event): event is ParsedSearchEvent => Boolean(event))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
  if (!events.length) return undefined

  let state: RoleSearchIntelligenceStateV35 | undefined
  for (const event of events) {
    const parsed = Date.parse(event.createdAt)
    const now = new Date(Number.isFinite(parsed) ? parsed : 0)
    if (event.action === 'c') state = undefined
    else state = setApprovedSearchEntityV35(state, event.entityId, event.action === 'a', now)
  }
  return state
}
