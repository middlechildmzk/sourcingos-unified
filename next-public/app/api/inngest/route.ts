import { serve } from 'inngest/next'
import { sourcingOsInngest } from '@/lib/inngest/client'
import { runFleetImprovementWorkV40_7b } from '@/lib/inngest/functions/fleet-improvement-v40-7b'

export const dynamic = 'force-dynamic'

export const { GET, POST, PUT } = serve({
  client: sourcingOsInngest,
  functions: [runFleetImprovementWorkV40_7b],
})
