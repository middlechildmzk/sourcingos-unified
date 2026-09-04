import { siteUrl } from '@/lib/site'

function JsonLd({ id, data }: { id: string; data: Record<string, unknown> }) {
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

export function SourcingOSOrganizationJsonLd() {
  return (
    <JsonLd
      id="sourcingos-organization-jsonld"
      data={{
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'SourcingOS',
        url: siteUrl,
        description:
          'SourcingOS is an AI-native, recruiter-controlled sourcing operating system for role intake, people search, source orchestration, evidence review, Candidate 360, and talent intelligence.',
      }}
    />
  )
}

export function SourcingOSWebsiteJsonLd() {
  return (
    <JsonLd
      id="sourcingos-website-jsonld"
      data={{
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'SourcingOS',
        url: siteUrl,
        description:
          'Recruiter-controlled sourcing intelligence, people search, evidence review, sourcing tools, methodology, training, and talent intelligence.',
        publisher: {
          '@type': 'Organization',
          name: 'SourcingOS',
          url: siteUrl,
        },
      }}
    />
  )
}
