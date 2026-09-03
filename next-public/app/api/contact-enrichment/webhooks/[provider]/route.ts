import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { handleAsyncContactWebhookV36_16, isAsyncContactProviderV36_16, publicAsyncContactJobV36_16 } from '@/lib/contact-enrichment/async-enrichment-service-v36-16'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params
  if (!isAsyncContactProviderV36_16(provider) || provider === 'coldiq') {
    return NextResponse.json({ ok: false, error: 'Unsupported asynchronous contact provider.' }, { status: 404 })
  }
  const jobId = req.nextUrl.searchParams.get('job')?.trim()
  const callbackToken = req.nextUrl.searchParams.get('token')?.trim()
  if (!jobId || !callbackToken) return NextResponse.json({ ok: false, error: 'Missing callback capability.' }, { status: 401 })

  let payload: unknown
  try { payload = await req.json() } catch { return NextResponse.json({ ok: false, error: 'Invalid provider webhook payload.' }, { status: 400 }) }

  try {
    const job = await handleAsyncContactWebhookV36_16({
      provider,
      jobId,
      callbackToken,
      payload,
      wizaAuthHeader: req.headers.get('x-auth-key'),
    })
    // Return 200 for valid duplicate/retry deliveries so providers do not keep
    // retrying a callback that SourcingOS has already processed idempotently.
    return NextResponse.json({ ok: true, job: publicAsyncContactJobV36_16(job) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Provider webhook could not be processed.'
    const unauthorized = /token|authentication/i.test(message)
    return NextResponse.json({ ok: false, error: message }, { status: unauthorized ? 401 : 502 })
  }
}
