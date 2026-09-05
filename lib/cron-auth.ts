import 'server-only'
import { timingSafeEqual } from 'node:crypto'

export type CronAuthState = 'authorized' | 'unauthorized' | 'unavailable'

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8')
  const b = Buffer.from(right, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Cron credentials are accepted only in request headers. Query-string secrets
 * are intentionally unsupported because URLs can be copied into logs, browser
 * history, analytics and referrer metadata.
 */
export function authorizeCronRequest(request: Request): CronAuthState {
  const secret = process.env.CRON_SECRET
  if (!secret) return 'unavailable'

  const bearer = request.headers.get('authorization')
  const headerSecret = request.headers.get('x-cron-secret')
  if (bearer?.startsWith('Bearer ') && safeEqual(bearer.slice(7), secret)) return 'authorized'
  if (headerSecret && safeEqual(headerSecret, secret)) return 'authorized'
  return 'unauthorized'
}
