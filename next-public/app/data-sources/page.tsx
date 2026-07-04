import Link from 'next/link'

export const metadata = {
  alternates: { canonical: '/data-sources/' },
  title: 'Data Sources | SourcingOS',
  description: 'The public sources behind SourcingOS Candidate Search: GitHub, Stack Overflow, OpenAlex, PubMed, ORCID, NPI, Hugging Face, npm, PyPI, crates.io, and RubyGems. And what SourcingOS never touches.'
}

const liveSources = [
  ['GitHub', 'Repos, languages, contribution activity, and profile links for engineers.'],
  ['Stack Overflow', 'Answer history and topic depth as a public technical signal.'],
  ['OpenAlex', 'Research papers, co-authors, and institutions for scientists and researchers.'],
  ['PubMed', 'Biomedical and clinical publication records.'],
  ['ORCID', 'Researcher identifiers and publicly listed affiliations.'],
  ['NPI Registry', 'Public provider records for healthcare sourcing context.'],
  ['Hugging Face', 'Models, datasets, and spaces for AI and ML practitioners.'],
  ['npm', 'JavaScript package maintainers and publish activity.'],
  ['PyPI', 'Python package maintainers and publish activity.'],
  ['crates.io', 'Rust package maintainers and publish activity.'],
  ['RubyGems', 'Ruby package maintainers and publish activity.'],
] as const

export default function DataSourcesPage() {
  return <main className="wrap article">
    <span className="kicker">Evidence sources</span>
    <h1>Data sources</h1>
    <p className="lead">SourcingOS searches open public sources and shows you where every piece of evidence came from. Here is the full list, and the list of what we will not touch.</p>

    <section>
      <h2>Live public sources</h2>
      {liveSources.map(([name, what]) => (
        <p key={name}><strong>{name}.</strong> {what}</p>
      ))}
      <p>Every result keeps its public URL attached. If you cannot click through to the source, it does not belong in the product.</p>
    </section>

    <section>
      <h2>What these sources are, and are not</h2>
      <p>A public profile is evidence about a body of work. It is not identity verification, not a verified clearance, not confirmed employment, and not permission to spam someone. Clearance language found in public text is an unverified clearance breadcrumb that requires human verification through your actual hiring process.</p>
    </section>

    <section>
      <h2>What SourcingOS does not touch</h2>
      <p>No LinkedIn scraping. No Indeed scraping. No ClearanceJobs scraping. No paid resume database scraping. No automation behind login walls, and no background crawling of restricted platforms.</p>
      <p>For those platforms, SourcingOS builds X-Ray strings and Boolean searches that you run yourself, in your own browser, under your own accounts and their terms.</p>
    </section>

    <section>
      <h2>User-imported data</h2>
      <p>If you import your own data, like a CSV export you are entitled to, it is labeled as a user-imported signal and stays in your workspace. It is never mixed into public evidence without provenance.</p>
      <p>
        <Link className="btn" href="/candidate-search">Try the public demo</Link>{' '}
        <Link className="btn secondary" href="/trust">Read the trust rules</Link>
      </p>
    </section>
  </main>
}
