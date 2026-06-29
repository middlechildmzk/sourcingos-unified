// ─────────────────────────────────────────────────────────────────────────────
// data/search-taxonomy.ts — Entity recognition dictionary for the Search Composer.
// Local rule-based only. No LLM required. Each entry has a canonical term,
// its entity type, aliases that trigger recognition, and display normalized form.
// ─────────────────────────────────────────────────────────────────────────────

export type EntityType =
  | 'title'
  | 'skill'
  | 'tool'
  | 'certification'
  | 'location'
  | 'clearance'
  | 'company'
  | 'industry'
  | 'seniority'
  | 'employment-signal'
  | 'source'

export interface TaxonomyEntry {
  canonical: string        // canonical display form
  type: EntityType
  aliases: string[]        // lowercased match strings including canonical
  color: string            // chip CSS class suffix
}

// ─── Titles ──────────────────────────────────────────────────────────────────
export const TITLES: TaxonomyEntry[] = [
  { canonical: 'Technical Sourcer',      type: 'title', color: 'title',
    aliases: ['technical sourcer', 'tech sourcer', 'talent sourcer', 'sourcer', 'recruiting researcher', 'research sourcer'] },
  { canonical: 'Technical Recruiter',    type: 'title', color: 'title',
    aliases: ['technical recruiter', 'tech recruiter', 'ta partner', 'talent acquisition partner'] },
  { canonical: 'DevSecOps Engineer',     type: 'title', color: 'title',
    aliases: ['devsecops', 'devsecops engineer', 'devops engineer', 'devops', 'platform engineer', 'sre', 'site reliability engineer'] },
  { canonical: 'Cybersecurity Engineer', type: 'title', color: 'title',
    aliases: ['cybersecurity engineer', 'cyber engineer', 'security engineer', 'information security engineer', 'infosec engineer'] },
  { canonical: 'Security Analyst',       type: 'title', color: 'title',
    aliases: ['security analyst', 'cyber analyst', 'information security analyst', 'soc analyst', 'isso', 'issm', 'cybersecurity analyst'] },
  { canonical: 'ML Engineer',            type: 'title', color: 'title',
    aliases: ['ml engineer', 'machine learning engineer', 'ai engineer', 'ai/ml engineer', 'mlops engineer', 'ml ops engineer', 'ml'] },
  { canonical: 'Data Scientist',         type: 'title', color: 'title',
    aliases: ['data scientist', 'data science', 'applied scientist', 'research scientist', 'computational scientist'] },
  { canonical: 'Software Engineer',      type: 'title', color: 'title',
    aliases: ['software engineer', 'software developer', 'swe', 'full stack engineer', 'full stack developer', 'backend engineer', 'frontend engineer'] },
  { canonical: 'Staff Engineer',         type: 'title', color: 'title',
    aliases: ['staff engineer', 'principal engineer', 'distinguished engineer', 'staff software engineer', 'principal software engineer'] },
  { canonical: 'Nurse Recruiter',        type: 'title', color: 'title',
    aliases: ['nurse recruiter', 'rn recruiter', 'clinical recruiter', 'healthcare recruiter', 'provider recruiter', 'nursing recruiter', 'travel nurse recruiter'] },
  { canonical: 'Federal Recruiter',      type: 'title', color: 'title',
    aliases: ['federal recruiter', 'federal', 'government recruiter', 'govcon recruiter', 'cleared recruiter', 'cleared talent', 'cleared recruiting'] },
  { canonical: 'Proposal Manager',       type: 'title', color: 'title',
    aliases: ['proposal manager', 'proposal recruiter', 'capture manager', 'proposal coordinator', 'proposal writer', 'business development', 'bd manager'] },
  { canonical: 'Recruiting Operations',  type: 'title', color: 'title',
    aliases: ['recruiting operations', 'recruiting ops', 'talent operations', 'ta ops', 'recruiting coordinator', 'hr coordinator'] },
  // Generic recruiter entry — placed AFTER specific variants so "nurse recruiter", "technical recruiter", etc. match first
  { canonical: 'Recruiter',             type: 'title', color: 'title',
    aliases: ['recruiter', 'talent acquisition', 'ta specialist', 'hr recruiter', 'talent acquisition specialist'] },
  { canonical: 'Nurse',                  type: 'title', color: 'title',
    aliases: ['rn', 'registered nurse', 'travel nurse', 'icu nurse', 'er nurse', 'critical care nurse', 'prn nurse', 'nicu nurse'] },
  { canonical: 'Kubernetes Engineer',    type: 'title', color: 'title',
    aliases: ['kubernetes engineer', 'k8s engineer', 'container engineer', 'cloud native engineer'] },
]

// ─── Skills & Tools ───────────────────────────────────────────────────────────
export const SKILLS: TaxonomyEntry[] = [
  // Cloud / Infra
  { canonical: 'Kubernetes', type: 'skill', color: 'skill',
    aliases: ['kubernetes', 'k8s', 'eks', 'aks', 'gke', 'rancher', 'openshift'] },
  { canonical: 'Terraform',  type: 'skill', color: 'skill',
    aliases: ['terraform', 'iac', 'infrastructure as code', 'pulumi', 'crossplane'] },
  { canonical: 'AWS',        type: 'skill', color: 'skill',
    aliases: ['aws', 'amazon web services', 'ec2', 's3', 'lambda', 'govcloud', 'aws govcloud'] },
  { canonical: 'Azure',      type: 'skill', color: 'skill',
    aliases: ['azure', 'microsoft azure', 'azure devops', 'azure government'] },
  { canonical: 'GCP',        type: 'skill', color: 'skill',
    aliases: ['gcp', 'google cloud', 'google cloud platform'] },
  { canonical: 'Docker',     type: 'skill', color: 'skill',
    aliases: ['docker', 'containers', 'container', 'dockerfile'] },
  // AI / ML
  { canonical: 'PyTorch',        type: 'tool', color: 'tool',
    aliases: ['pytorch', 'torch'] },
  { canonical: 'TensorFlow',     type: 'tool', color: 'tool',
    aliases: ['tensorflow', 'keras'] },
  { canonical: 'Hugging Face',   type: 'tool', color: 'tool',
    aliases: ['hugging face', 'huggingface', 'transformers', 'hf'] },
  { canonical: 'LLM',            type: 'skill', color: 'skill',
    aliases: ['llm', 'large language model', 'large language models', 'generative ai', 'gen ai', 'genai'] },
  { canonical: 'NLP',            type: 'skill', color: 'skill',
    aliases: ['nlp', 'natural language processing'] },
  { canonical: 'MLOps',          type: 'skill', color: 'skill',
    aliases: ['mlops', 'ml ops', 'model serving', 'model deployment'] },
  // Cybersecurity
  { canonical: 'Splunk',         type: 'tool', color: 'tool',
    aliases: ['splunk'] },
  { canonical: 'SIEM',           type: 'skill', color: 'skill',
    aliases: ['siem', 'security information and event management'] },
  { canonical: 'CrowdStrike',    type: 'tool', color: 'tool',
    aliases: ['crowdstrike', 'falcon'] },
  { canonical: 'Palo Alto',      type: 'tool', color: 'tool',
    aliases: ['palo alto', 'palo alto networks', 'panorama', 'prisma'] },
  { canonical: 'NIST RMF',       type: 'skill', color: 'skill',
    aliases: ['rmf', 'nist rmf', 'risk management framework', 'nist', 'fedramp', 'fisma', 'cmmc', 'disa stig', 'stig'] },
  { canonical: 'Pen Testing',    type: 'skill', color: 'skill',
    aliases: ['pen testing', 'penetration testing', 'pentest', 'red team', 'offensive security'] },
  // Healthcare
  { canonical: 'Epic',           type: 'tool', color: 'tool',
    aliases: ['epic', 'epic systems', 'epic emr', 'epic ehr'] },
  { canonical: 'Cerner',         type: 'tool', color: 'tool',
    aliases: ['cerner', 'cerner millennium', 'oracle health'] },
  { canonical: 'EMR/EHR',        type: 'skill', color: 'skill',
    aliases: ['emr', 'ehr', 'electronic medical record', 'electronic health record', 'hl7', 'fhir'] },
  // Dev Languages
  { canonical: 'Python',         type: 'skill', color: 'skill',
    aliases: ['python'] },
  { canonical: 'Go',             type: 'skill', color: 'skill',
    aliases: ['golang', 'go lang', 'go language'] },
  { canonical: 'Rust',           type: 'skill', color: 'skill',
    aliases: ['rust', 'rustlang'] },
  { canonical: 'TypeScript',     type: 'skill', color: 'skill',
    aliases: ['typescript', 'ts'] },
  { canonical: 'React',          type: 'skill', color: 'skill',
    aliases: ['react', 'reactjs', 'react.js', 'next.js', 'nextjs'] },
  { canonical: 'Vue',            type: 'skill', color: 'skill',
    aliases: ['vue', 'vuejs', 'vue.js', 'nuxt'] },
  { canonical: 'Angular',        type: 'skill', color: 'skill',
    aliases: ['angular', 'angularjs'] },
  { canonical: 'JavaScript',     type: 'skill', color: 'skill',
    aliases: ['javascript', 'js', 'es6', 'ecmascript'] },
  { canonical: 'HTML/CSS',       type: 'skill', color: 'skill',
    aliases: ['html', 'css', 'html5', 'css3', 'scss', 'sass'] },
  { canonical: 'Tailwind',       type: 'tool', color: 'tool',
    aliases: ['tailwind', 'tailwindcss', 'tailwind css'] },
  { canonical: 'Redux',          type: 'tool', color: 'tool',
    aliases: ['redux', 'redux toolkit', 'zustand', 'mobx'] },
  { canonical: 'GraphQL',        type: 'skill', color: 'skill',
    aliases: ['graphql', 'apollo', 'apollo client'] },
  { canonical: 'REST API',       type: 'skill', color: 'skill',
    aliases: ['rest api', 'rest apis', 'restful', 'rest', 'api design'] },
  { canonical: 'Vite',           type: 'tool', color: 'tool',
    aliases: ['vite', 'webpack', 'esbuild', 'rollup'] },
  { canonical: 'Git',            type: 'tool', color: 'tool',
    aliases: ['git', 'github actions', 'gitlab ci', 'version control'] },
  { canonical: 'Accessibility',  type: 'skill', color: 'skill',
    aliases: ['accessibility', 'a11y', 'wcag', 'aria', 'section 508'] },
  { canonical: 'Design Systems',  type: 'skill', color: 'skill',
    aliases: ['design systems', 'design system', 'component library', 'component libraries', 'storybook'] },
  { canonical: 'CI/CD',          type: 'skill', color: 'skill',
    aliases: ['ci/cd', 'cicd', 'continuous integration', 'continuous deployment', 'pipeline'] },
]

// ─── Certifications ───────────────────────────────────────────────────────────
export const CERTIFICATIONS: TaxonomyEntry[] = [
  { canonical: 'CISSP',      type: 'certification', color: 'cert',
    aliases: ['cissp'] },
  { canonical: 'Security+',  type: 'certification', color: 'cert',
    aliases: ['security+', 'security plus', 'comptia security+'] },
  { canonical: 'CEH',        type: 'certification', color: 'cert',
    aliases: ['ceh', 'certified ethical hacker'] },
  { canonical: 'CISM',       type: 'certification', color: 'cert',
    aliases: ['cism'] },
  { canonical: 'GIAC',       type: 'certification', color: 'cert',
    aliases: ['giac', 'sans giac', 'gcih', 'gpen', 'grem', 'gsec'] },
  { canonical: 'AWS Certified', type: 'certification', color: 'cert',
    aliases: ['aws certified', 'aws certification', 'aws solutions architect', 'aws sa', 'aws developer', 'aws devops'] },
  { canonical: 'PMP',        type: 'certification', color: 'cert',
    aliases: ['pmp', 'project management professional'] },
  { canonical: 'RN',         type: 'certification', color: 'cert',
    aliases: ['bsn', 'msn', 'aprn', 'np', 'nurse practitioner', 'pa-c', 'physician assistant'] },
]

// ─── Clearances ───────────────────────────────────────────────────────────────
export const CLEARANCES: TaxonomyEntry[] = [
  { canonical: 'TS/SCI',      type: 'clearance', color: 'clearance',
    aliases: ['ts/sci', 'ts sci', 'top secret sci', 'tssci'] },
  { canonical: 'Top Secret',  type: 'clearance', color: 'clearance',
    aliases: ['top secret', 'ts', 'top secret clearance', 'ts clearance'] },
  { canonical: 'Secret',      type: 'clearance', color: 'clearance',
    aliases: ['secret clearance', 'active secret', 'dod secret', 'secret-level clearance'] },
  { canonical: 'Polygraph',   type: 'clearance', color: 'clearance',
    aliases: ['polygraph', 'poly', 'ci poly', 'ci polygraph', 'full scope poly', 'full scope polygraph', 'lifestyle poly'] },
  { canonical: 'Public Trust', type: 'clearance', color: 'clearance',
    aliases: ['public trust', 'mbi', 'moderate background investigation'] },
  { canonical: 'Clearable',   type: 'clearance', color: 'clearance',
    aliases: ['clearable', 'clearance eligible', 'us citizen', 'us citizenship required'] },
]

// ─── Locations ────────────────────────────────────────────────────────────────
export const LOCATIONS: TaxonomyEntry[] = [
  { canonical: 'Remote',              type: 'location', color: 'location',
    aliases: ['remote', 'fully remote', 'remote only', 'remote-first', 'remote us', 'wfh'] },
  { canonical: 'Hybrid',              type: 'location', color: 'location',
    aliases: ['hybrid', 'hybrid remote', 'hybrid work'] },
  { canonical: 'Northern Virginia',   type: 'location', color: 'location',
    aliases: ['northern virginia', 'nova', 'reston', 'herndon', 'mclean', 'chantilly', 'sterling', 'tysons', 'tysons corner', 'fairfax', 'arlington'] },
  { canonical: 'Washington DC',       type: 'location', color: 'location',
    aliases: ['washington dc', 'washington d.c.', 'dc', 'district of columbia', 'dmv', 'maryland', 'bethesda', 'rockville', 'silver spring'] },
  { canonical: 'San Francisco Bay Area', type: 'location', color: 'location',
    aliases: ['san francisco', 'sf', 'bay area', 'silicon valley', 'san jose', 'palo alto', 'mountain view', 'sunnyvale', 'menlo park'] },
  { canonical: 'Austin TX',           type: 'location', color: 'location',
    aliases: ['austin', 'austin tx', 'austin texas'] },
  { canonical: 'New York',            type: 'location', color: 'location',
    aliases: ['new york', 'nyc', 'new york city', 'manhattan', 'brooklyn'] },
  { canonical: 'Seattle WA',          type: 'location', color: 'location',
    aliases: ['seattle', 'seattle wa', 'redmond', 'bellevue wa', 'kirkland wa'] },
  { canonical: 'Minnesota',           type: 'location', color: 'location',
    aliases: ['minnesota', 'mn', 'twin cities', 'minneapolis', 'st paul', 'rochester mn'] },
  { canonical: 'Tampa FL',            type: 'location', color: 'location',
    aliases: ['tampa', 'tampa fl', 'st petersburg fl', 'clearwater fl', 'sarasota'] },
  { canonical: 'Colorado',            type: 'location', color: 'location',
    aliases: ['colorado', 'co', 'colorado springs', 'denver', 'aurora co'] },
  { canonical: 'San Antonio TX',      type: 'location', color: 'location',
    aliases: ['san antonio', 'san antonio tx', 'san antonio texas'] },
]

// ─── Industries ───────────────────────────────────────────────────────────────
export const INDUSTRIES: TaxonomyEntry[] = [
  { canonical: 'GovCon',        type: 'industry', color: 'industry',
    aliases: ['govcon', 'government contracting', 'federal', 'government contractor', 'defense contractor', 'defense', 'dod', 'ic', 'intelligence community'] },
  { canonical: 'Healthcare',    type: 'industry', color: 'industry',
    aliases: ['healthcare', 'health care', 'hospital', 'clinical', 'medical', 'health system', 'health tech'] },
  { canonical: 'Cybersecurity', type: 'industry', color: 'industry',
    aliases: ['cybersecurity', 'cyber', 'infosec', 'information security'] },
  { canonical: 'AI/ML',         type: 'industry', color: 'industry',
    aliases: ['ai/ml', 'ai ml', 'ml', 'artificial intelligence', 'machine learning industry', 'ai startup', 'ai company'] },
  { canonical: 'FinTech',       type: 'industry', color: 'industry',
    aliases: ['fintech', 'financial technology', 'finance tech', 'banking technology'] },
  { canonical: 'SaaS',          type: 'industry', color: 'industry',
    aliases: ['saas', 'software as a service', 'b2b saas', 'enterprise saas'] },
  { canonical: 'Biotech',       type: 'industry', color: 'industry',
    aliases: ['biotech', 'biotechnology', 'biopharma', 'pharmaceutical', 'life sciences'] },
]

// ─── Companies ────────────────────────────────────────────────────────────────
export const COMPANIES: TaxonomyEntry[] = [
  { canonical: 'Booz Allen Hamilton',   type: 'company', color: 'company',
    aliases: ['booz allen', 'booz allen hamilton', 'bah'] },
  { canonical: 'SAIC',                  type: 'company', color: 'company',
    aliases: ['saic', 'science applications international'] },
  { canonical: 'Leidos',               type: 'company', color: 'company',
    aliases: ['leidos'] },
  { canonical: 'CACI',                 type: 'company', color: 'company',
    aliases: ['caci'] },
  { canonical: 'L3Harris',             type: 'company', color: 'company',
    aliases: ['l3harris', 'l3 harris', 'harris corporation'] },
  { canonical: 'Parsons',              type: 'company', color: 'company',
    aliases: ['parsons corporation', 'parsons'] },
  { canonical: 'Amazon',              type: 'company', color: 'company',
    aliases: ['amazon', 'aws amazon', 'amazon web services'] },
  { canonical: 'Google',              type: 'company', color: 'company',
    aliases: ['google', 'alphabet', 'deepmind'] },
  { canonical: 'Microsoft',           type: 'company', color: 'company',
    aliases: ['microsoft', 'msft'] },
  { canonical: 'Meta',                type: 'company', color: 'company',
    aliases: ['meta', 'facebook'] },
  { canonical: 'Apple',               type: 'company', color: 'company',
    aliases: ['apple'] },
  { canonical: 'OpenAI',              type: 'company', color: 'company',
    aliases: ['openai', 'open ai'] },
  { canonical: 'Anthropic',           type: 'company', color: 'company',
    aliases: ['anthropic'] },
]

// ─── Seniority ────────────────────────────────────────────────────────────────
export const SENIORITY: TaxonomyEntry[] = [
  { canonical: 'Senior',      type: 'seniority', color: 'seniority',
    aliases: ['senior', 'sr', 'sr.'] },
  { canonical: 'Staff',       type: 'seniority', color: 'seniority',
    aliases: ['staff'] },
  { canonical: 'Principal',   type: 'seniority', color: 'seniority',
    aliases: ['principal'] },
  { canonical: 'Lead',        type: 'seniority', color: 'seniority',
    aliases: ['lead', 'tech lead', 'team lead'] },
  { canonical: 'Junior',      type: 'seniority', color: 'seniority',
    aliases: ['junior', 'jr', 'jr.', 'entry level', 'entry-level'] },
]

// ─── Employment signals ───────────────────────────────────────────────────────
export const EMPLOYMENT_SIGNALS: TaxonomyEntry[] = [
  { canonical: 'Open to Work',   type: 'employment-signal', color: 'signal',
    aliases: ['open to work', 'actively looking', 'open to opportunities', '#opentowork'] },
  { canonical: 'Contract',       type: 'employment-signal', color: 'signal',
    aliases: ['contract', 'contract to hire', 'c2h', 'w2 contract', '1099'] },
  { canonical: 'Full-time',      type: 'employment-signal', color: 'signal',
    aliases: ['full time', 'full-time', 'fte', 'permanent'] },
  { canonical: 'Freelance',      type: 'employment-signal', color: 'signal',
    aliases: ['freelance', 'freelancer', 'independent contractor', 'self-employed'] },
]

// ─── Flat list for recognition engine ────────────────────────────────────────
export const ALL_TAXONOMY: TaxonomyEntry[] = [
  ...CLEARANCES,     // check clearances first — TS/SCI before "TS" as title
  ...TITLES,
  ...CERTIFICATIONS,
  ...SKILLS,
  ...LOCATIONS,
  ...INDUSTRIES,
  ...COMPANIES,
  ...SENIORITY,
  ...EMPLOYMENT_SIGNALS,
].sort((a, b) => {
  // Longest aliases first to ensure multi-word phrases match before single words
  const maxLenA = Math.max(...a.aliases.map(al => al.length))
  const maxLenB = Math.max(...b.aliases.map(al => al.length))
  return maxLenB - maxLenA
})
