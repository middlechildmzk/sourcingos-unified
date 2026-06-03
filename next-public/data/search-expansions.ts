// ─────────────────────────────────────────────────────────────────────────────
// data/search-expansions.ts — Smart expansion suggestions for detected entities.
// Keys are lowercase canonical terms. Values are arrays of related terms, aliases,
// and adjacent signals a recruiter would want to add.
// ─────────────────────────────────────────────────────────────────────────────

export const EXPANSIONS: Record<string, string[]> = {
  // ── Titles
  'technical sourcer':      ['Talent Sourcer', 'Engineering Sourcer', 'TA Researcher', 'Recruiting Researcher', 'Technical Recruiter', 'Talent Acquisition Specialist'],
  'technical recruiter':    ['Technical Sourcer', 'Engineering Recruiter', 'TA Partner', 'Talent Acquisition Partner', 'Engineering Talent Lead'],
  'devsecops engineer':     ['DevOps Engineer', 'Platform Engineer', 'SRE', 'Infrastructure Engineer', 'Cloud Engineer', 'Release Engineer'],
  'ml engineer':            ['Machine Learning Engineer', 'AI Engineer', 'MLOps Engineer', 'Research Engineer', 'Data Scientist', 'Applied Scientist'],
  'cybersecurity engineer': ['Security Engineer', 'Information Security Engineer', 'Network Security Engineer', 'Cloud Security Engineer', 'AppSec Engineer'],
  'security analyst':       ['SOC Analyst', 'Threat Analyst', 'ISSO', 'ISSM', 'Cyber Analyst', 'Intelligence Analyst'],
  'software engineer':      ['Software Developer', 'Full Stack Engineer', 'Backend Engineer', 'Frontend Engineer', 'SWE'],
  'staff engineer':         ['Principal Engineer', 'Senior Staff Engineer', 'Distinguished Engineer', 'Architect'],
  'nurse recruiter':        ['RN Recruiter', 'Clinical Recruiter', 'Nurse Recruiter', 'Healthcare Recruiter', 'Travel Nurse Recruiter', 'Provider Recruiter'],
  'federal recruiter':      ['Cleared Recruiter', 'GovCon Recruiter', 'DoD Recruiter', 'IC Recruiter', 'Government Recruiter'],
  'data scientist':         ['ML Engineer', 'Applied Scientist', 'Research Scientist', 'Quantitative Analyst', 'Analytics Engineer'],
  'nurse':                  ['RN', 'BSN', 'MSN', 'APRN', 'NP', 'Travel Nurse', 'Critical Care Nurse', 'ICU Nurse', 'ER Nurse'],
  'kubernetes engineer':    ['K8s Engineer', 'Container Engineer', 'Cloud Native Engineer', 'Platform Engineer'],

  // ── Skills / Tools
  'kubernetes':             ['K8s', 'EKS', 'AKS', 'GKE', 'Helm', 'ArgoCD', 'containers', 'Docker', 'Rancher', 'OpenShift'],
  'terraform':              ['Pulumi', 'IaC', 'CloudFormation', 'CDK', 'Ansible', 'infrastructure as code'],
  'aws':                    ['EC2', 'S3', 'Lambda', 'EKS', 'GovCloud', 'AWS GovCloud', 'Amazon Web Services'],
  'azure':                  ['Azure DevOps', 'Azure Government', 'MSFT Azure', 'AKS', 'Microsoft 365'],
  'gcp':                    ['BigQuery', 'GKE', 'Vertex AI', 'Google Cloud', 'Looker'],
  'docker':                 ['containers', 'container', 'Kubernetes', 'Compose', 'Dockerfile'],
  'pytorch':                ['PyTorch Lightning', 'CUDA', 'GPU training', 'Hugging Face', 'deep learning'],
  'tensorflow':             ['Keras', 'TFX', 'TensorFlow Serving', 'deep learning', 'ML pipeline'],
  'hugging face':           ['Transformers', 'PEFT', 'LoRA', 'fine-tuning', 'open source LLM', 'Diffusers'],
  'llm':                    ['GPT', 'Claude', 'Llama', 'Mistral', 'RAG', 'embeddings', 'vector database', 'fine-tuning'],
  'nlp':                    ['NLU', 'text classification', 'sentiment analysis', 'named entity recognition', 'transformers'],
  'mlops':                  ['model serving', 'Kubeflow', 'MLflow', 'Airflow', 'feature store', 'model monitoring'],
  'splunk':                 ['SIEM', 'log analysis', 'threat hunting', 'SOC', 'QRadar', 'Sentinel'],
  'siem':                   ['Splunk', 'QRadar', 'Microsoft Sentinel', 'LogRhythm', 'threat detection', 'SOC'],
  'crowdstrike':            ['EDR', 'endpoint detection', 'Falcon', 'threat intelligence'],
  'palo alto':              ['NGFW', 'Prisma', 'Panorama', 'firewall', 'zero trust'],
  'nist rmf':               ['RMF', 'FedRAMP', 'FISMA', 'CMMC', 'DISA STIG', 'ATO', 'authorization to operate'],
  'pen testing':            ['penetration testing', 'red team', 'OSCP', 'bug bounty', 'vulnerability assessment', 'GPEN'],
  'epic':                   ['Epic EMR', 'MyChart', 'Epic Certified', 'EHR', 'Beaker', 'Willow', 'Clarity'],
  'cerner':                 ['Oracle Health', 'Cerner Millennium', 'PowerChart', 'EHR integration'],
  'emr/ehr':                ['Epic', 'Cerner', 'Meditech', 'HL7', 'FHIR', 'Allscripts', 'athenahealth'],
  'python':                 ['PyPI', 'pandas', 'NumPy', 'FastAPI', 'Django', 'Flask', 'scikit-learn'],
  'go':                     ['Golang', 'gRPC', 'Go microservices'],
  'rust':                   ['crates.io', 'WebAssembly', 'Rust systems programming'],
  'react':                  ['TypeScript', 'JavaScript', 'Next.js', 'Redux', 'GraphQL', 'Tailwind', 'Vite', 'frontend'],
  'front end developer':    ['Frontend Engineer', 'Front End Engineer', 'UI Engineer', 'React Engineer', 'JavaScript Engineer', 'Web Engineer', 'Senior Frontend Engineer'],
  'frontend engineer':      ['Front End Engineer', 'UI Engineer', 'React Engineer', 'JavaScript Engineer', 'Web Engineer'],
  'backend engineer':       ['Backend Developer', 'API Engineer', 'Server Engineer', 'Python Engineer', 'Node.js Engineer', 'Go Engineer'],
  'platform engineer':      ['DevOps Engineer', 'Infrastructure Engineer', 'SRE', 'Cloud Engineer', 'Kubernetes Engineer'],

  // ── Certifications
  'cissp':                  ['CISM', 'Security+', 'GIAC', 'CEH', 'CCSP', 'SSCP'],
  'security+':              ['CompTIA', 'CISSP', 'CEH', 'GIAC GSEC', 'Network+'],
  'giac':                   ['GCIH', 'GPEN', 'GREM', 'GSEC', 'SANS training', 'GCIA'],
  'aws certified':          ['AWS Solutions Architect', 'AWS DevOps Pro', 'AWS Security Specialty', 'Azure Certified', 'GCP Associate'],
  'rn':                     ['BSN', 'MSN', 'APRN', 'NP', 'Clinical nurse', 'RN-BC'],

  // ── Clearances
  'ts/sci':                 ['Top Secret SCI', 'TS SCI', 'Polygraph', 'CI Poly', 'Full Scope Poly', 'lifestyle poly', 'SAP', 'SAR'],
  'top secret':             ['TS/SCI', 'SCI eligible', 'active clearance', 'cleared', 'DoD cleared'],
  'secret':                 ['Secret clearance', 'active secret', 'DoD secret', 'clearable'],
  'polygraph':              ['CI Poly', 'Full Scope Poly', 'Lifestyle Poly', 'TS/SCI with Poly'],
  'public trust':           ['MBI', 'background investigation', 'suitability', 'trustworthiness'],
  'clearable':              ['US Citizen', 'US citizenship', 'no prior clearance required', 'clearance sponsorship'],

  // ── Locations
  'remote':                 ['Remote US', 'fully remote', 'distributed team', '#remote', 'work from home', 'WFH'],
  'northern virginia':      ['Northern Virginia', 'NOVA', 'Reston VA', 'Herndon VA', 'McLean VA', 'Chantilly VA', 'Arlington VA', 'Tysons', 'Sterling VA'],
  'washington dc':          ['Washington DC', 'DC Metro', 'Maryland', 'Bethesda MD', 'Rockville MD', 'National Capital Region'],
  'san francisco bay area': ['SF Bay Area', 'Silicon Valley', 'Palo Alto', 'Mountain View', 'Sunnyvale', 'San Jose', 'Menlo Park'],
  'austin tx':              ['Austin Texas', 'Round Rock TX', 'Cedar Park TX'],
  'minnesota':              ['Twin Cities', 'Minneapolis', 'St Paul', 'Rochester MN'],
  'colorado':               ['Denver', 'Colorado Springs', 'Boulder', 'Aurora CO'],

  // ── Industries / Domains
  'govcon':                 ['DoD', 'DHS', 'Intelligence Community', 'IC', 'defense contractor', 'federal civilian', 'SBIR', 'OTA'],
  'healthcare':             ['health system', 'hospital', 'clinical', 'ambulatory', 'home health', 'behavioral health', 'revenue cycle'],
  'cybersecurity':          ['zero trust', 'SOC', 'CISO', 'threat intelligence', 'incident response', 'vulnerability management'],
  'ai/ml':                  ['generative AI', 'foundation models', 'LLM', 'computer vision', 'NLP', 'data science', 'research'],
  'fintech':                ['banking', 'payments', 'trading', 'wealth management', 'InsurTech', 'blockchain', 'DeFi'],
  'saas':                   ['B2B SaaS', 'enterprise software', 'cloud software', 'platform', 'product-led growth', 'PLG'],

  // ── Companies → Adjacent/Competitor targets
  'booz allen hamilton':    ['SAIC', 'Leidos', 'CACI', 'Peraton', 'Parsons', 'Acclaim Technical', 'Telos'],
  'saic':                   ['Booz Allen Hamilton', 'Leidos', 'CACI', 'L3Harris', 'Peraton'],
  'leidos':                 ['SAIC', 'Booz Allen Hamilton', 'Northrop Grumman', 'Raytheon'],
  'amazon':                 ['AWS', 'Google', 'Microsoft', 'Stripe', 'Uber', 'Lyft'],
  'google':                 ['DeepMind', 'Waymo', 'YouTube', 'Alphabet', 'Meta', 'Amazon'],
  'openai':                 ['Anthropic', 'Cohere', 'Mistral', 'AI21 Labs', 'xAI'],
}

// ─── Source lane recommendations by entity type ────────────────────────────────
export interface SourceLane {
  id: string
  name: string
  status: 'live' | 'preview' | 'manual-safe' | 'requires-key' | 'planned'
  url?: string
  queryTemplate?: string
  description: string
}

export const SOURCE_LANES_BY_ENTITY: Record<string, string[]> = {
  'title-technical':     ['github', 'stackoverflow', 'npm', 'pypi', 'devto'],
  'title-healthcare':    ['npi', 'pubmed', 'openalex'],
  'title-govcon':        ['clearancejobs', 'usajobs', 'github', 'openalex'],
  'title-ai-ml':         ['github', 'huggingface', 'openalex', 'arxiv', 'pypi', 'kaggle'],
  'title-cyber':         ['github', 'openalex', 'stackoverflow'],
  'title-recruiting':    ['linkedin-xray', 'github'],
  'skill-cloud':         ['github', 'stackoverflow', 'npm'],
  'skill-ai':            ['github', 'huggingface', 'openalex', 'pypi', 'arxiv'],
  'skill-healthcare':    ['npi', 'pubmed'],
  'skill-security':      ['github', 'openalex', 'stackoverflow'],
  'location-remote':     ['github', 'stackoverflow', 'npm', 'pypi', 'openalex'],
  'clearance':           ['clearancejobs', 'usajobs', 'github'],
  'industry-govcon':     ['clearancejobs', 'usajobs', 'github', 'openalex'],
  'industry-healthcare': ['npi', 'pubmed', 'openalex'],
  'industry-ai':         ['github', 'huggingface', 'openalex', 'pypi', 'arxiv', 'kaggle'],
  'default':             ['github', 'openalex', 'npm', 'pypi'],
}

export const ALL_SOURCE_LANES: SourceLane[] = [
  { id: 'github',        name: 'GitHub',              status: 'live',         description: 'Profile and contribution search',                queryTemplate: 'QUERY location:LOCATION' },
  { id: 'openalex',      name: 'OpenAlex',            status: 'live',         description: 'Open academic publication database',             queryTemplate: 'QUERY' },
  { id: 'npm',           name: 'npm',                 status: 'live',         description: 'Package author lookup',                          queryTemplate: 'QUERY' },
  { id: 'pypi',          name: 'PyPI',                status: 'live',         description: 'Python package author lookup',                   queryTemplate: 'QUERY' },
  { id: 'huggingface',   name: 'Hugging Face',        status: 'live',         description: 'Model and dataset authors',                      queryTemplate: 'QUERY' },
  { id: 'crates',        name: 'crates.io',           status: 'live',         description: 'Rust package authors',                           queryTemplate: 'QUERY' },
  { id: 'rubygems',      name: 'RubyGems',            status: 'live',         description: 'Ruby gem authors',                               queryTemplate: 'QUERY' },
  { id: 'stackoverflow', name: 'Stack Overflow',      status: 'preview',      description: 'Q&A contribution signals',                       queryTemplate: '' },
  { id: 'arxiv',         name: 'arXiv',               status: 'preview',      description: 'Preprint paper search',                          queryTemplate: '' },
  { id: 'pubmed',        name: 'PubMed',              status: 'preview',      description: 'Clinical publication search',                    queryTemplate: '' },
  { id: 'orcid',         name: 'ORCID',               status: 'preview',      description: 'Researcher ID registry',                         queryTemplate: '' },
  { id: 'semantic_scholar', name: 'Semantic Scholar', status: 'preview',      description: 'AI-indexed academic search',                     queryTemplate: '' },
  { id: 'npi',           name: 'NPI Registry',        status: 'preview',      description: 'US healthcare provider registry',                queryTemplate: '' },
  { id: 'devto',         name: 'DEV.to',              status: 'preview',      description: 'Developer articles and community',               queryTemplate: '' },
  { id: 'dockerhub',     name: 'Docker Hub',          status: 'preview',      description: 'Container image authors',                        queryTemplate: '' },
  { id: 'kaggle',        name: 'Kaggle',              status: 'manual-safe',  description: 'Data science competition profiles',              url: 'https://www.kaggle.com/search?q=QUERY' },
  { id: 'linkedin-xray', name: 'LinkedIn (X-Ray)',    status: 'manual-safe',  description: 'Generate Google X-Ray — review manually',       url: 'https://www.google.com/search?q=site:linkedin.com/in+QUERY' },
  { id: 'resume-xray',   name: 'Resume X-Ray',        status: 'manual-safe',  description: 'Google X-Ray for public resumes',               url: 'https://www.google.com/search?q=filetype:pdf+resume+QUERY' },
  { id: 'clearancejobs', name: 'ClearanceJobs',       status: 'manual-safe',  description: 'Cleared talent — review manually',              url: 'https://www.clearancejobs.com/jobs?q=QUERY' },
  { id: 'usajobs',       name: 'USAJOBS',             status: 'planned',      description: 'Federal job listings — sourcing integration planned', url: 'https://www.usajobs.gov/search?keyword=QUERY' },
]
