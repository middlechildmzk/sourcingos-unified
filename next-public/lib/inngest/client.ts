import 'server-only'

import { Inngest } from 'inngest'

/**
 * Shared SourcingOS Inngest client. Credentials are read from the standard
 * INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY environment variables supplied by
 * the Vercel Marketplace integration. Never pass secret values through UI or
 * event payloads.
 */
export const sourcingOsInngest = new Inngest({
  id: 'sourcingos',
})
