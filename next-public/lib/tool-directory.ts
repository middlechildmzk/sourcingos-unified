import { tools as baseTools, type Tool } from '@/data/tools'

export type ToolDirectoryMeta = {
  officialUrl?: string
  affiliateUrl?: string
  affiliateStatus: 'not_configured' | 'direct' | 'partner' | 'pending'
  pricingNote?: string
  reviewSummary?: string
  implementationNotes?: string[]
  alternatives?: string[]
  caution?: string
}

export type ToolRecord = Tool & ToolDirectoryMeta

const meta: Record<string, ToolDirectoryMeta> = {
  'linkedin-recruiter': { officialUrl: 'https://business.linkedin.com/talent-solutions/recruiter', affiliateStatus: 'not_configured', caution: 'Use inside LinkedIn terms. SourcingOS supports manual X-Ray strings, not scraping or login automation.' },
  hireez: { officialUrl: 'https://hireez.com/', affiliateStatus: 'pending' },
  seekout: { officialUrl: 'https://www.seekout.com/', affiliateStatus: 'pending' },
  'juicebox-peoplegpt': { officialUrl: 'https://www.juicebox.ai/', affiliateStatus: 'pending' },
  gem: { officialUrl: 'https://www.gem.com/', affiliateStatus: 'pending' },
  ashby: { officialUrl: 'https://www.ashbyhq.com/', affiliateStatus: 'pending' },
  greenhouse: { officialUrl: 'https://www.greenhouse.com/', affiliateStatus: 'pending' },
  lever: { officialUrl: 'https://www.lever.co/', affiliateStatus: 'pending' },
  loxo: { officialUrl: 'https://loxo.co/', affiliateStatus: 'pending' },
  recruiterflow: { officialUrl: 'https://recruiterflow.com/', affiliateStatus: 'pending' },
  contactout: { officialUrl: 'https://contactout.com/', affiliateStatus: 'pending', caution: 'Contact signals need consent and accuracy review before outreach.' },
  apollo: { officialUrl: 'https://www.apollo.io/', affiliateStatus: 'pending', caution: 'Sales-style outreach tooling needs recruiting-specific compliance review.' },
  lusha: { officialUrl: 'https://www.lusha.com/', affiliateStatus: 'pending', caution: 'Treat phone/email data as unverified until confirmed.' },
  rocketreach: { officialUrl: 'https://rocketreach.co/', affiliateStatus: 'pending' },
  hunter: { officialUrl: 'https://hunter.io/', affiliateStatus: 'pending' },
  swordfish: { officialUrl: 'https://swordfish.ai/', affiliateStatus: 'pending' },
  clearancejobs: { officialUrl: 'https://www.clearancejobs.com/', affiliateStatus: 'not_configured', caution: 'Do not scrape. Use under platform rules. Public clearance language outside the platform is not verification.' },
  dice: { officialUrl: 'https://www.dice.com/', affiliateStatus: 'pending' },
  'indeed-resume': { officialUrl: 'https://www.indeed.com/hire', affiliateStatus: 'not_configured', caution: 'No scraping or automation behind login walls.' },
  github: { officialUrl: 'https://github.com/', affiliateStatus: 'not_configured' },
  'stack-overflow': { officialUrl: 'https://stackoverflow.com/', affiliateStatus: 'not_configured' },
  openalex: { officialUrl: 'https://openalex.org/', affiliateStatus: 'not_configured' },
  'semantic-scholar': { officialUrl: 'https://www.semanticscholar.org/', affiliateStatus: 'not_configured' },
  orcid: { officialUrl: 'https://orcid.org/', affiliateStatus: 'not_configured' },
  'hugging-face': { officialUrl: 'https://huggingface.co/', affiliateStatus: 'not_configured' },
  npm: { officialUrl: 'https://www.npmjs.com/', affiliateStatus: 'not_configured' },
  pypi: { officialUrl: 'https://pypi.org/', affiliateStatus: 'not_configured' },
  'docker-hub': { officialUrl: 'https://hub.docker.com/', affiliateStatus: 'not_configured' },
  'npi-registry': { officialUrl: 'https://npiregistry.cms.hhs.gov/search', affiliateStatus: 'not_configured' },
  clinicaltrialsgov: { officialUrl: 'https://clinicaltrials.gov/', affiliateStatus: 'not_configured' },
  pubmed: { officialUrl: 'https://pubmed.ncbi.nlm.nih.gov/', affiliateStatus: 'not_configured' },
  'nih-reporter': { officialUrl: 'https://reporter.nih.gov/', affiliateStatus: 'not_configured' },
  'cisa-kev': { officialUrl: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', affiliateStatus: 'not_configured' },
  nvd: { officialUrl: 'https://nvd.nist.gov/', affiliateStatus: 'not_configured' },
  arxiv: { officialUrl: 'https://arxiv.org/', affiliateStatus: 'not_configured' },
  crossref: { officialUrl: 'https://www.crossref.org/', affiliateStatus: 'not_configured' },
  zoominfo: { officialUrl: 'https://www.zoominfo.com/', affiliateStatus: 'pending' },
  snovio: { officialUrl: 'https://snov.io/', affiliateStatus: 'pending' },
  clay: { officialUrl: 'https://www.clay.com/', affiliateStatus: 'pending' },
  phenom: { officialUrl: 'https://www.phenom.com/', affiliateStatus: 'pending' },
  eightfold: { officialUrl: 'https://eightfold.ai/', affiliateStatus: 'pending' },
  beamery: { officialUrl: 'https://beamery.com/', affiliateStatus: 'pending' },
  findem: { officialUrl: 'https://www.findem.ai/', affiliateStatus: 'pending' },
  pin: { officialUrl: 'https://www.pin.com/', affiliateStatus: 'pending' },
  manatal: { officialUrl: 'https://www.manatal.com/', affiliateStatus: 'pending' },
  avature: { officialUrl: 'https://www.avature.net/', affiliateStatus: 'pending' },
  wellfound: { officialUrl: 'https://wellfound.com/', affiliateStatus: 'pending' },
  'built-in': { officialUrl: 'https://builtin.com/', affiliateStatus: 'pending' },
  doximity: { officialUrl: 'https://www.doximity.com/', affiliateStatus: 'pending' },
  'state-licensing-boards': { affiliateStatus: 'not_configured', caution: 'Use the correct state board source and credentialing process.' },
  'google-programmable-search': { officialUrl: 'https://programmablesearchengine.google.com/', affiliateStatus: 'not_configured' },
}

const osintTools: ToolRecord[] = [
  { id: 'google-dorks', name: 'Google Dorks / Advanced Search Operators', category: 'OSINT', description: 'Manual search operators for finding public profiles, resumes, portfolios, talks, repositories, and source evidence.', bestFor: 'Best for repeatable open-web sourcing without scraping.', cost: 'Free', sourcingOSFit: 98, officialUrl: 'https://www.google.com/advanced_search', affiliateStatus: 'not_configured', caution: 'Manual-safe only. Do not use automated scraping against restricted platforms.' },
  { id: 'bing-advanced-search', name: 'Bing Advanced Search', category: 'OSINT', description: 'Alternative search index for X-Ray queries, public resumes, PDFs, profiles, and open-web sourcing.', bestFor: 'Best for cross-checking Google X-Ray results.', cost: 'Free', sourcingOSFit: 82, officialUrl: 'https://www.bing.com/', affiliateStatus: 'not_configured' },
  { id: 'wayback-machine', name: 'Wayback Machine', category: 'OSINT', description: 'Archived web pages for historical company, profile, project, and portfolio context.', bestFor: 'Best for timeline context and old portfolio/research evidence.', cost: 'Free', sourcingOSFit: 84, officialUrl: 'https://web.archive.org/', affiliateStatus: 'not_configured' },
  { id: 'builtwith', name: 'BuiltWith', category: 'OSINT', description: 'Technology lookup for websites and company tech-stack research.', bestFor: 'Best for donor-company mapping and tech-stack sourcing hypotheses.', cost: 'Paid/varies', sourcingOSFit: 78, officialUrl: 'https://builtwith.com/', affiliateStatus: 'pending' },
  { id: 'wappalyzer', name: 'Wappalyzer', category: 'OSINT', description: 'Website technology profiler for stack research and market mapping.', bestFor: 'Best for identifying tech environments before sourcing.', cost: 'Paid/varies', sourcingOSFit: 76, officialUrl: 'https://www.wappalyzer.com/', affiliateStatus: 'pending' },
  { id: 'shodan', name: 'Shodan', category: 'OSINT', description: 'Internet-exposed asset search used for security research and company infrastructure context.', bestFor: 'Best for cyber sourcing context and employer environment research, not candidate data.', cost: 'Paid/varies', sourcingOSFit: 72, officialUrl: 'https://www.shodan.io/', affiliateStatus: 'pending', caution: 'Use for context and lawful security research only. Do not use to target individuals.' },
  { id: 'censys', name: 'Censys', category: 'OSINT', description: 'Internet asset search and attack-surface intelligence for security context.', bestFor: 'Best for cyber market mapping and source-pack research.', cost: 'Paid/varies', sourcingOSFit: 70, officialUrl: 'https://censys.com/', affiliateStatus: 'pending', caution: 'Use for lawful company/security context, not personal targeting.' },
  { id: 'crtsh', name: 'crt.sh', category: 'OSINT', description: 'Certificate transparency search for domains, subdomains, and company infrastructure clues.', bestFor: 'Best for company mapping and technical environment research.', cost: 'Free', sourcingOSFit: 74, officialUrl: 'https://crt.sh/', affiliateStatus: 'not_configured' },
  { id: 'whois', name: 'WHOIS / ICANN Lookup', category: 'OSINT', description: 'Domain registration lookup for public domain and ownership context where available.', bestFor: 'Best for company/domain research and source validation.', cost: 'Free', sourcingOSFit: 68, officialUrl: 'https://lookup.icann.org/', affiliateStatus: 'not_configured', caution: 'Respect privacy redaction and do not infer personal contact permission.' },
  { id: 'crunchbase', name: 'Crunchbase', category: 'OSINT', description: 'Company, funding, leadership, and market intelligence for donor-company mapping.', bestFor: 'Best for building target company lists and market maps.', cost: 'Paid/varies', sourcingOSFit: 82, officialUrl: 'https://www.crunchbase.com/', affiliateStatus: 'pending' },
  { id: 'wellfound-osint', name: 'Wellfound Startup Search', category: 'OSINT', description: 'Startup company and hiring market discovery for target-company mapping.', bestFor: 'Best for startup talent ecosystems and donor-company discovery.', cost: 'Free/Paid', sourcingOSFit: 73, officialUrl: 'https://wellfound.com/', affiliateStatus: 'pending' },
  { id: 'reddit-search', name: 'Reddit Search', category: 'OSINT', description: 'Public communities, hiring discussions, niche skill communities, and sourcing-market context.', bestFor: 'Best for finding communities and vocabulary, not importing profiles.', cost: 'Free', sourcingOSFit: 71, officialUrl: 'https://www.reddit.com/search/', affiliateStatus: 'not_configured', caution: 'Respect community norms and privacy. Public posts are context, not permission to contact.' },
]

export const toolRecords: ToolRecord[] = [
  ...baseTools.map(tool => {
    const { affiliateStatus = 'not_configured', pricingNote, ...restMeta } = meta[tool.id] || {}
    return {
      ...tool,
      ...restMeta,
      affiliateStatus,
      pricingNote: pricingNote || tool.cost,
    }
  }),
  ...osintTools,
]

export const toolCategories = ['All', ...Array.from(new Set(toolRecords.map(t => t.category))).sort()]

export function getToolById(id: string) {
  return toolRecords.find(tool => tool.id === id)
}

export function toolHref(tool: ToolRecord) {
  return `/directory/${tool.id}`
}

export function outboundHref(tool: ToolRecord) {
  return tool.affiliateUrl || tool.officialUrl || `https://www.google.com/search?q=${encodeURIComponent(tool.name)}`
}

export function affiliateLabel(tool: ToolRecord) {
  if (tool.affiliateStatus === 'direct') return 'Affiliate link configured'
  if (tool.affiliateStatus === 'partner') return 'Partner link configured'
  if (tool.affiliateStatus === 'pending') return 'Affiliate candidate'
  return 'No affiliate link configured yet'
}
