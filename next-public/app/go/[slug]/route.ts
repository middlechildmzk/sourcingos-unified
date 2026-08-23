import { NextRequest, NextResponse } from 'next/server'

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

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { slug } = await params
  const partner = partners[slug]

  if (!partner) {
    return NextResponse.redirect(new URL('/directory/', req.url), { status: 302 })
  }

  const configured = partner.env ? process.env[partner.env]?.trim() : undefined
  const destination = configured || partner.official

  return NextResponse.redirect(destination, { status: 302 })
}
