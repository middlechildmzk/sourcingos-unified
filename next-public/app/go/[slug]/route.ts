import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ slug: string }> }

type Partner = {
  official: string
  env?: string
}

const partners: Record<string, Partner> = {
  contactout: { official: 'https://contactout.com/', env: 'SOURCINGOS_CONTACTOUT_AFFILIATE_URL' },
  lusha: { official: 'https://www.lusha.com/recruiters/', env: 'SOURCINGOS_LUSHA_AFFILIATE_URL' },
  apollo: { official: 'https://www.apollo.io/', env: 'SOURCINGOS_APOLLO_AFFILIATE_URL' },
  hunter: { official: 'https://hunter.io/', env: 'SOURCINGOS_HUNTER_AFFILIATE_URL' },
  linkedin: { official: 'https://business.linkedin.com/talent-solutions/recruiter' },
  hireez: { official: 'https://hireez.com/', env: 'SOURCINGOS_HIREEZ_AFFILIATE_URL' },
  seekout: { official: 'https://www.seekout.com/', env: 'SOURCINGOS_SEEKOUT_AFFILIATE_URL' },
  juicebox: { official: 'https://juicebox.ai/', env: 'SOURCINGOS_JUICEBOX_AFFILIATE_URL' },
}

function referringPath(req: NextRequest): string | null {
  const referrer = req.headers.get('referer')
  if (!referrer) return null
  try {
    return new URL(referrer).pathname.slice(0, 300)
  } catch {
    return null
  }
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { slug } = await params
  const partner = partners[slug]

  if (!partner) {
    return NextResponse.redirect(new URL('/directory/', req.url), { status: 302 })
  }

  const configured = partner.env ? process.env[partner.env]?.trim() : undefined
  const destination = configured || partner.official

  const sb = createServerSupabaseClient()
  if (sb) {
    const { error } = await sb.from('analytics_events').insert({
      event: 'partner_exit',
      label: slug,
      page: referringPath(req),
      source: slug,
      variant: configured ? 'affiliate' : 'official',
      session_hash: null,
      occurred_at: new Date().toISOString(),
    })
    if (error) console.error('[partner_exit] analytics write failed:', error.message)
  }

  return NextResponse.redirect(destination, { status: 302 })
}
