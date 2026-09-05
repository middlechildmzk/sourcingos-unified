import { serve } from 'inngest/next'
import { sourcingOsInngest } from '@/lib/inngest/client'
import { runFleetImprovementWorkV40_7b } from '@/lib/inngest/functions/fleet-improvement-v40-7b'

export const dynamic = 'force-dynamic'

// Vercel Deployment Protection applies to the immutable deployment hostname used
// by the marketplace sync hook. Production's canonical domain is public, so make
// that origin explicit when the SDK registers function configuration with
// Inngest Cloud. Preview deployments continue to infer their own origin.
const productionServeHost = process.env.VERCEL_ENV === 'production'
  ? 'https://www.getsourcingos.com'
  : undefined

export const { GET, POST, PUT } = serve({
  client: sourcingOsInngest,
  functions: [runFleetImprovementWorkV40_7b],
  ...(productionServeHost ? { serveHost: productionServeHost } : {}),
})
