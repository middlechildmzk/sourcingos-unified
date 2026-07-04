export type AuthorityPage = {
  slug: string
  title: string
  description: string
  intent: string
  format: 'Definition' | 'Guide' | 'Checklist' | 'Template' | 'Comparison' | 'Library' | 'Playbook'
  sections: { heading: string; body: string }[]
  bullets: string[]
  faqs: { question: string; answer: string }[]
  ctaHref: string
  ctaLabel: string
}

export const authorityPages: AuthorityPage[] = [
  {
    slug: 'source-pack-template-library',
    title: 'Source Pack Template Library for Recruiters',
    description: 'A practical template library for turning hard-to-fill roles into search lanes, Boolean strings, donor maps, false-positive filters, and evidence review steps.',
    intent: 'source pack template, sourcing strategy template, recruiter sourcing plan',
    format: 'Template',
    sections: [
      { heading: 'Direct answer', body: 'A source pack is the working plan a sourcer builds before searching. It defines role outcomes, evidence standards, search lanes, strings, donor companies, exclusions, and follow-up questions.' },
      { heading: 'Why it works', body: 'A single search string hides why a search is failing. A source pack lets you test lanes separately and show which constraints are helping or hurting the search.' },
      { heading: 'What to include', body: 'Include strict evidence, flexible evidence, title variants, adjacent roles, target companies, source surfaces, exclusions, low-result rescue steps, and hiring manager calibration questions.' },
      { heading: 'SourcingOS workflow', body: 'Use the JD Strategy Tool to draft the pack, Search Lane Expander to create variants, and Candidate Search to review public evidence.' },
    ],
    bullets: ['Define the strict market first.', 'Create at least one adjacent lane.', 'Attach false-positive filters.', 'Write verify-next questions before outreach.'],
    faqs: [
      { question: 'Is a source pack just a Boolean string?', answer: 'No. Boolean is one output. The source pack is the operating plan around the search.' },
      { question: 'When should I build one?', answer: 'Build one for hard-to-fill technical, healthcare, AI, senior specialist, or constrained roles.' },
    ],
    ctaHref: '/tools/jd-search-strategy',
    ctaLabel: 'Build a source pack',
  },
  {
    slug: 'boolean-search-library-for-recruiters',
    title: 'Boolean Search Library for Recruiters',
    description: 'A role-by-role Boolean search library for recruiters covering technical, cyber, AI, healthcare, data, recruiting, and executive search lanes.',
    intent: 'Boolean search strings for recruiters, recruiter Boolean library, sourcing Boolean examples',
    format: 'Library',
    sections: [
      { heading: 'Direct answer', body: 'A recruiter Boolean library should organize searches by role family, source lane, strict or broad mode, and false-positive filters.' },
      { heading: 'The three-string pattern', body: 'For each role, create a strict string, a broad string, and an evidence string. Compare source quality instead of endlessly editing one query.' },
      { heading: 'How to debug', body: 'If results are too small, loosen titles or location first. If results are noisy, add evidence terms or exclusions.' },
      { heading: 'SourcingOS workflow', body: 'BooleanOS and Search Lane Expander generate strings that can be carried into Candidate Search for evidence review.' },
    ],
    bullets: ['Use strict and broad variants.', 'Pair titles with evidence terms.', 'Add exclusions before the query gets noisy.', 'Keep public evidence separate from final conclusions.'],
    faqs: [
      { question: 'What is the best Boolean string for recruiters?', answer: 'There is no universal best string. The best string matches the role family, source, and desired recall level.' },
      { question: 'Should Boolean strings be long?', answer: 'Only when necessary. Short lane-specific strings are easier to debug.' },
    ],
    ctaHref: '/tools/boolean-generator',
    ctaLabel: 'Generate Boolean strings',
  },
  {
    slug: 'manual-safe-xray-search-guide',
    title: 'Manual-Safe X-Ray Search Guide for Sourcers',
    description: 'A practical X-Ray search guide for finding public sourcing evidence without scraping restricted platforms or automating behind login walls.',
    intent: 'X-Ray search for recruiters, manual safe X-Ray search, Google X-Ray sourcing',
    format: 'Guide',
    sections: [
      { heading: 'Direct answer', body: 'Manual-safe X-Ray means generating public search strings that a recruiter opens and reviews manually. It does not mean scraping, auto-importing, or bypassing platform rules.' },
      { heading: 'Best first lanes', body: 'Use public resume X-Ray, portfolio X-Ray, GitHub profile X-Ray, conference speaker X-Ray, research profile X-Ray, and company domain X-Ray.' },
      { heading: 'What not to do', body: 'Do not automate restricted platforms, bulk collect profiles, or treat search-result snippets as confirmed facts.' },
      { heading: 'SourcingOS workflow', body: 'The X-Ray Launcher and Search Lane Expander prepare manual-safe lanes, then Candidate Search helps review public evidence.' },
    ],
    bullets: ['Open results manually.', 'Review the primary source before saving anything.', 'Use exclusions to remove jobs and training pages.', 'Keep source links attached.'],
    faqs: [
      { question: 'Is X-Ray search scraping?', answer: 'No, not when it is a manual public search. Risk increases when automated collection or restricted sources are involved.' },
      { question: 'Can I X-Ray professional networks?', answer: 'You can generate manual search strings, but SourcingOS does not scrape or automate anything behind login walls.' },
    ],
    ctaHref: '/tools/xray-search',
    ctaLabel: 'Open X-Ray Launcher',
  },
  {
    slug: 'public-evidence-only-sourcing',
    title: 'Public Evidence Only Sourcing: What It Means and What It Does Not Claim',
    description: 'A clear definition of public-evidence-only sourcing for recruiters, including source profiles, public signals, missing data, and review boundaries.',
    intent: 'public evidence sourcing, source profile vs candidate profile, evidence review sourcing',
    format: 'Definition',
    sections: [
      { heading: 'Direct answer', body: 'Public-evidence-only sourcing uses publicly accessible source material to understand possible role relevance while keeping every claim tied to its source and every uncertainty visible.' },
      { heading: 'What it can show', body: 'It can show public work, writing, repositories, publications, package activity, registry records, talks, company context, and source snippets.' },
      { heading: 'What it cannot prove', body: 'It does not prove current employment, identity, availability, contact accuracy, willingness to talk, or final fit.' },
      { heading: 'SourcingOS workflow', body: 'Candidate Search treats results as source profiles until a recruiter reviews the evidence and decides what to do next.' },
    ],
    bullets: ['Evidence is not final verification.', 'Signals are not claims.', 'Missing data stays visible.', 'Recruiter judgment stays in the loop.'],
    faqs: [
      { question: 'Is public evidence the same as a candidate profile?', answer: 'No. A source profile is evidence for review. A candidate profile requires recruiter confirmation and process context.' },
      { question: 'Can public evidence replace screening?', answer: 'No. It can improve sourcing decisions, but it does not replace recruiter review.' },
    ],
    ctaHref: '/trust',
    ctaLabel: 'Read the trust rules',
  },
  {
    slug: 'source-profile-vs-candidate-profile',
    title: 'Source Profile vs Candidate Profile: The Difference Recruiters Need to Know',
    description: 'A definition page explaining source profiles, candidate profiles, Candidate 360 dossiers, and why public evidence should not be treated as final confirmation.',
    intent: 'source profile vs candidate profile, recruiter candidate profile, Candidate 360 definition',
    format: 'Definition',
    sections: [
      { heading: 'Direct answer', body: 'A source profile is a public evidence record. A candidate profile is a recruiter-reviewed record used in a hiring process. They are not the same thing.' },
      { heading: 'Source profile', body: 'It contains public URLs, snippets, matched skills, source relevance, missing data, and verify-next steps.' },
      { heading: 'Candidate profile', body: 'It may include recruiter notes, confirmed identity matches, authorized contact data, process status, and manager-ready summaries.' },
      { heading: 'Candidate 360', body: 'Candidate 360 is the dossier layer that summarizes evidence, gaps, risks, and next steps after recruiter review.' },
    ],
    bullets: ['Source profile equals evidence record.', 'Candidate profile equals process record.', 'Candidate 360 equals reviewed dossier.', 'Do not skip the review step.'],
    faqs: [
      { question: 'Why does the distinction matter?', answer: 'It prevents weak public signals from becoming overconfident recruiting claims.' },
      { question: 'Can AI create candidate profiles?', answer: 'AI can help structure evidence, but candidate records need human review and authorized data handling.' },
    ],
    ctaHref: '/sample-candidate-360',
    ctaLabel: 'View Candidate 360 sample',
  },
]
