'use client'

import { useEffect, useRef } from 'react'

type ClientErrorPayload = {
  kind: 'window_error' | 'unhandled_rejection'
  name: string
  message: string
  stack: string
  route: string
  build: string
  occurredAt: string
}

function redact(value: unknown, max: number): string {
  return String(value || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/https?:\/\/[^\s)\]}]+/gi, '[redacted-url]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, '[redacted-id]')
    .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[redacted-phone]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted-token]')
    .slice(0, max)
}

function errorParts(value: unknown): { name: string; message: string; stack: string } {
  if (value instanceof Error) {
    return {
      name: redact(value.name || 'Error', 100),
      message: redact(value.message || 'Unknown client error', 500),
      stack: redact(value.stack || '', 2500),
    }
  }
  return { name: 'NonErrorRejection', message: redact(value, 500), stack: '' }
}

export function ClientErrorReporter() {
  const sent = useRef(new Set<string>())

  useEffect(() => {
    function report(kind: ClientErrorPayload['kind'], value: unknown) {
      const parts = errorParts(value)
      const route = typeof window === 'undefined' ? '' : window.location.pathname.slice(0, 300)
      const signature = `${kind}|${parts.name}|${parts.message}|${route}`
      if (sent.current.has(signature)) return
      sent.current.add(signature)
      if (sent.current.size > 100) sent.current.clear()

      const payload: ClientErrorPayload = {
        kind,
        ...parts,
        route,
        build: redact(process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'local', 100),
        occurredAt: new Date().toISOString(),
      }

      void fetch('/api/client-errors', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin',
        keepalive: true,
      }).catch(() => undefined)
    }

    const onWindowError = (event: ErrorEvent) => report('window_error', event.error || event.message)
    const onUnhandledRejection = (event: PromiseRejectionEvent) => report('unhandled_rejection', event.reason)
    window.addEventListener('error', onWindowError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    return () => {
      window.removeEventListener('error', onWindowError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [])

  return null
}
