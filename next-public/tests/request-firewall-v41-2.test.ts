import { describe, expect, it } from 'vitest'
import { requestFirewallDecisionV41_2 } from '@/lib/request-firewall-v41-2'

describe('request firewall v41.2', () => {
  it('allows the methods required by Inngest and normal app traffic', () => {
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']) {
      expect(requestFirewallDecisionV41_2({ method, pathname: '/api/inngest' })).toEqual({ action: 'allow' })
    }
  })

  it('allows Vercel cron and well-known paths', () => {
    expect(requestFirewallDecisionV41_2({ method: 'GET', pathname: '/api/cron/resume-sprint/' })).toEqual({ action: 'allow' })
    expect(requestFirewallDecisionV41_2({ method: 'GET', pathname: '/.well-known/acme-challenge/example' })).toEqual({ action: 'allow' })
  })

  it('rejects unsupported tunnel and trace methods', () => {
    for (const method of ['CONNECT', 'TRACE', 'TRACK']) {
      expect(requestFirewallDecisionV41_2({ method, pathname: '/api/inngest' })).toMatchObject({ action: 'deny', status: 405 })
    }
  })

  it('returns not-found for common secret and repository probes', () => {
    for (const pathname of ['/.env', '/.ENV.production', '/.git/config', '/.git/objects/a', '/wp-config.php', '/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php']) {
      expect(requestFirewallDecisionV41_2({ method: 'GET', pathname })).toMatchObject({ action: 'deny', status: 404 })
    }
  })

  it('rejects malformed traversal/backslash paths without touching legitimate routes', () => {
    expect(requestFirewallDecisionV41_2({ method: 'GET', pathname: '/app/../admin' })).toMatchObject({ action: 'deny', status: 404 })
    expect(requestFirewallDecisionV41_2({ method: 'GET', pathname: '/app\\admin' })).toMatchObject({ action: 'deny', status: 404 })
    expect(requestFirewallDecisionV41_2({ method: 'GET', pathname: '/app/search/' })).toEqual({ action: 'allow' })
  })
})
