import { siteUrl } from '@/lib/site'

type JsonLdProps = {
  id: string
  data: Record<string, unknown>
}

function JsonLd({ id, data }: JsonLdProps) {
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

export function OrganizationJsonLd() {
  return (
    <JsonLd
      id="sourcingos-organization-jsonld"
      data={{
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'SourcingOS',
        url: siteUrl,
        description:
          'SourcingOS is a human-approved sourcing intelligence OS for recruiters that turns role intake into public-source search lanes, evidence review, and recruiter-confirmed Candidate 360 dossiers.',
        sameAs: [
          'https://www.getsourcingos.com/about/',
          'https://www.getsourcingos.com/methodology/',
          'https://www.getsourcingos.com/trust/',
        ],
      }}
    />
  )
}

export function WebsiteJsonLd() {
  return (
    <JsonLd
      id="sourcingos-website-jsonld"
      data={{
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'SourcingOS',
        url: siteUrl,
        description:
          'Free sourcing tools, open-web search strategy, evidence review, and recruiter training for technical, cleared, healthcare, and AI recruiting.',
        publisher: {
          '@type': 'Organization',
          name: 'SourcingOS',
          url: siteUrl,
        },
      }}
    />
  )
}

export function FaqJsonLd({ id, faqs }: { id: string; faqs: { question: string; answer: string }[] }) {
  return (
    <JsonLd
      id={id}
      data={{
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map(faq => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      }}
    />
  )
}

export function HowToJsonLd({
  id,
  name,
  description,
  steps,
}: {
  id: string
  name: string
  description: string
  steps: string[]
}) {
  return (
    <JsonLd
      id={id}
      data={{
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name,
        description,
        step: steps.map((step, index) => ({
          '@type': 'HowToStep',
          position: index + 1,
          text: step,
        })),
      }}
    />
  )
}
