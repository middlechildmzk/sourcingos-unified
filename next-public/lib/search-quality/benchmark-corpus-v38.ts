export type SearchBenchmarkFamilyV38 =
  | 'cleared_federal'
  | 'software_engineering'
  | 'data_ai'
  | 'gtm'
  | 'talent_recruiting'
  | 'healthcare'
  | 'engineering_hardware'
  | 'product_program'
  | 'finance'
  | 'operations_supply_chain'

export type SearchBenchmarkScenarioV38 = {
  id: string
  family: SearchBenchmarkFamilyV38
  label: string
  query: string
  expected: {
    titles: string[]
    skills: string[]
    locations: string[]
    mustHave: string[]
    niceToHave?: string[]
    clearance?: string
    proximityIntent?: boolean
    remoteIntent?: boolean
    discoveryOnly?: string[]
    neverInfer?: string[]
  }
}

/**
 * Human-reviewed intent corpus. These are expected recruiter semantics, not
 * synthetic candidate labels. Candidate relevance qrels belong to benchmark
 * runs after a recruiter/evaluator has reviewed actual observations.
 */
export const SEARCH_BENCHMARK_CORPUS_V38: SearchBenchmarkScenarioV38[] = [
  {
    id: 'cleared-rhel-annapolis', family: 'cleared_federal', label: 'Cleared RHEL administrator — Annapolis Junction',
    query: 'Find me a RHEL admin with 5+ years of experience in or near Annapolis Junction, MD with Secret clearance or higher',
    expected: {
      titles: ['RHEL Administrator'], skills: ['RHEL'], locations: ['Annapolis Junction, MD'],
      mustHave: ['RHEL', '5+ years relevant experience', 'Secret clearance or higher'], clearance: 'Secret or higher', proximityIntent: true,
      discoveryOnly: ['Red Hat Enterprise Linux Administrator', 'Linux Administrator', 'Linux Systems Administrator', 'Systems Administrator', 'Fort Meade, MD', 'Jessup, MD', 'Laurel, MD', 'Columbia, MD', 'Odenton, MD', 'SELinux', 'Satellite', 'Ansible'],
      neverInfer: ['Linux proves RHEL', 'Fort Meade proves residence', 'Secret requirement proves clearance', 'TS/SCI means TypeScript'],
    },
  },
  {
    id: 'cleared-cyber-fort-meade', family: 'cleared_federal', label: 'Cybersecurity engineer — Fort Meade',
    query: 'Find a cybersecurity engineer near Fort Meade, MD with Splunk, Security+ and TS/SCI clearance',
    expected: { titles: ['Cybersecurity Engineer'], skills: ['Splunk'], locations: ['Fort Meade, MD'], mustHave: ['Splunk', 'Security+', 'TS/SCI clearance'], clearance: 'TS/SCI', proximityIntent: true, discoveryOnly: ['Cyber Security Engineer', 'Information Security Engineer', 'Security Engineer'], neverInfer: ['employer contract proves clearance'] },
  },
  {
    id: 'cleared-cloud-nova', family: 'cleared_federal', label: 'Cleared cloud engineer — Northern Virginia',
    query: 'Find a cloud engineer in Northern Virginia with AWS, Terraform, Ansible and Secret clearance',
    expected: { titles: ['Cloud Engineer'], skills: ['AWS', 'Terraform', 'Ansible'], locations: ['Northern Virginia'], mustHave: ['AWS', 'Terraform', 'Ansible', 'Secret clearance'], clearance: 'Secret', neverInfer: ['AWS certification from AWS skill', 'location from employer'] },
  },
  {
    id: 'cleared-devsecops-dc', family: 'cleared_federal', label: 'DevSecOps engineer — DC metro',
    query: 'Find a DevSecOps engineer in the DC metro with Kubernetes, CI/CD, Terraform, AWS and Secret clearance or higher',
    expected: { titles: ['DevSecOps Engineer'], skills: ['Kubernetes', 'Terraform', 'AWS'], locations: ['DC metro'], mustHave: ['Kubernetes', 'CI/CD', 'Terraform', 'AWS', 'Secret clearance or higher'], clearance: 'Secret or higher', neverInfer: ['Kubernetes proves Terraform'] },
  },
  {
    id: 'cleared-systems-dod', family: 'cleared_federal', label: 'DoD systems engineer',
    query: 'Find a systems engineer with Windows, Linux, VMware and DoD environment experience with Secret clearance',
    expected: { titles: ['Systems Engineer'], skills: ['Windows', 'Linux', 'VMware'], locations: [], mustHave: ['Windows', 'Linux', 'VMware', 'DoD environment experience', 'Secret clearance'], clearance: 'Secret' },
  },

  {
    id: 'backend-python-remote', family: 'software_engineering', label: 'Senior backend engineer — Python',
    query: 'Find a senior backend engineer with Python, FastAPI or Django, and Postgres, remote in the US',
    expected: { titles: ['Senior Backend Engineer'], skills: ['Python', 'FastAPI', 'Django', 'Postgres'], locations: ['United States'], mustHave: ['Python', 'Postgres'], niceToHave: ['FastAPI or Django'], remoteIntent: true },
  },
  {
    id: 'fullstack-react-node', family: 'software_engineering', label: 'Senior full stack engineer',
    query: 'Find a senior full stack engineer with React, TypeScript, Node.js and AWS',
    expected: { titles: ['Senior Full Stack Engineer'], skills: ['React', 'TypeScript', 'Node.js', 'AWS'], locations: [], mustHave: ['React', 'TypeScript', 'Node.js', 'AWS'] },
  },
  {
    id: 'staff-java-distributed', family: 'software_engineering', label: 'Staff Java engineer',
    query: 'Find a staff Java engineer with Spring Boot, microservices and distributed systems experience',
    expected: { titles: ['Staff Java Engineer'], skills: ['Java', 'Spring Boot'], locations: [], mustHave: ['Java', 'Spring Boot', 'microservices', 'distributed systems experience'] },
  },
  {
    id: 'platform-k8s-cloud', family: 'software_engineering', label: 'Platform engineer — Kubernetes',
    query: 'Find a platform engineer with Kubernetes, Terraform, AWS or GCP, and an SRE background',
    expected: { titles: ['Platform Engineer'], skills: ['Kubernetes', 'Terraform', 'AWS', 'GCP'], locations: [], mustHave: ['Kubernetes', 'Terraform', 'SRE background'], niceToHave: ['AWS or GCP'], neverInfer: ['SRE equals DevSecOps'] },
  },

  {
    id: 'ml-engineer-llm', family: 'data_ai', label: 'ML engineer — production LLMs',
    query: 'Find a machine learning engineer with PyTorch, LLMs and production ML experience, Boston or remote US',
    expected: { titles: ['Machine Learning Engineer'], skills: ['PyTorch', 'LLMs'], locations: ['Boston, MA', 'United States'], mustHave: ['PyTorch', 'LLMs', 'production ML experience'], remoteIntent: true },
  },
  {
    id: 'ml-research-transformers', family: 'data_ai', label: 'ML research scientist — NLP',
    query: 'Find an ML research scientist with transformers, NLP and publication or research experience',
    expected: { titles: ['ML Research Scientist'], skills: ['transformers', 'NLP'], locations: [], mustHave: ['transformers', 'NLP'], niceToHave: ['publication or research experience'], discoveryOnly: ['Machine Learning Researcher', 'Machine Learning Scientist', 'Research Scientist', 'Applied Scientist'] },
  },
  {
    id: 'data-engineer-modern-stack', family: 'data_ai', label: 'Data engineer — modern stack',
    query: 'Find a data engineer with Python, Spark, Snowflake and Airflow',
    expected: { titles: ['Data Engineer'], skills: ['Python', 'Spark', 'Snowflake', 'Airflow'], locations: [], mustHave: ['Python', 'Spark', 'Snowflake', 'Airflow'] },
  },

  {
    id: 'enterprise-ae-saas', family: 'gtm', label: 'Enterprise account executive',
    query: 'Find an enterprise account executive with B2B SaaS experience selling $100k+ ACV deals',
    expected: { titles: ['Enterprise Account Executive'], skills: ['B2B SaaS'], locations: [], mustHave: ['B2B SaaS experience', '$100k+ ACV deals', 'enterprise sales'] },
  },
  {
    id: 'solutions-consultant-presales', family: 'gtm', label: 'Solutions consultant — enterprise SaaS',
    query: 'Find a solutions consultant with technical SaaS pre-sales experience supporting enterprise customers',
    expected: { titles: ['Solutions Consultant'], skills: ['technical SaaS', 'pre-sales'], locations: [], mustHave: ['technical SaaS', 'pre-sales', 'enterprise customers'] },
  },
  {
    id: 'enterprise-csm', family: 'gtm', label: 'Enterprise customer success manager',
    query: 'Find a customer success manager with enterprise SaaS, renewals and expansion experience',
    expected: { titles: ['Customer Success Manager'], skills: ['enterprise SaaS', 'renewals', 'expansion'], locations: [], mustHave: ['enterprise SaaS', 'renewals', 'expansion'] },
  },
  {
    id: 'revops-systems', family: 'gtm', label: 'Revenue operations',
    query: 'Find a RevOps leader with Salesforce, HubSpot and forecasting experience',
    expected: { titles: ['Revenue Operations'], skills: ['Salesforce', 'HubSpot', 'forecasting'], locations: [], mustHave: ['Salesforce', 'HubSpot', 'forecasting'] },
  },

  {
    id: 'senior-technical-sourcer', family: 'talent_recruiting', label: 'Senior technical sourcer',
    query: 'Find a senior technical sourcer with software engineering sourcing, LinkedIn Recruiter, and SeekOut or HireEZ experience',
    expected: { titles: ['Senior Technical Sourcer'], skills: ['software engineering sourcing', 'LinkedIn Recruiter', 'SeekOut', 'HireEZ'], locations: [], mustHave: ['software engineering sourcing', 'LinkedIn Recruiter'], niceToHave: ['SeekOut or HireEZ'], discoveryOnly: ['Talent Sourcer', 'Senior Talent Sourcer', 'Technical Sourcer', 'Recruiting Sourcer', 'Sourcing Recruiter'] },
  },
  {
    id: 'federal-cleared-recruiter', family: 'talent_recruiting', label: 'Federal cleared recruiter',
    query: 'Find a federal recruiter with cleared technical recruiting and GovCon experience',
    expected: { titles: ['Federal Recruiter'], skills: ['cleared technical recruiting', 'GovCon'], locations: [], mustHave: ['cleared technical recruiting', 'GovCon experience'], neverInfer: ['recruiter personally holds candidate clearance'] },
  },

  {
    id: 'icu-rn', family: 'healthcare', label: 'ICU registered nurse',
    query: 'Find an ICU registered nurse with 3+ years of critical care experience and an active RN license in Minnesota',
    expected: { titles: ['ICU Registered Nurse'], skills: ['critical care'], locations: ['Minnesota'], mustHave: ['3+ years relevant experience', 'critical care experience', 'active RN license'], neverInfer: ['RN title proves active license'] },
  },
  {
    id: 'clinical-trial-manager', family: 'healthcare', label: 'Clinical trial manager',
    query: 'Find a clinical trial manager with oncology studies, CRO oversight and Phase II or III experience',
    expected: { titles: ['Clinical Trial Manager'], skills: ['oncology studies', 'CRO oversight'], locations: [], mustHave: ['oncology studies', 'CRO oversight'], niceToHave: ['Phase II or III experience'] },
  },

  {
    id: 'mechanical-aerospace', family: 'engineering_hardware', label: 'Mechanical engineer — aerospace',
    query: 'Find a senior mechanical engineer with aerospace, SolidWorks and GD&T experience',
    expected: { titles: ['Senior Mechanical Engineer'], skills: ['aerospace', 'SolidWorks', 'GD&T'], locations: [], mustHave: ['aerospace', 'SolidWorks', 'GD&T'] },
  },
  {
    id: 'electrical-embedded', family: 'engineering_hardware', label: 'Electrical engineer — embedded hardware',
    query: 'Find an electrical engineer with PCB design, embedded systems and Altium experience',
    expected: { titles: ['Electrical Engineer'], skills: ['PCB design', 'embedded systems', 'Altium'], locations: [], mustHave: ['PCB design', 'embedded systems', 'Altium'] },
  },

  {
    id: 'product-manager-b2b', family: 'product_program', label: 'Senior product manager — B2B SaaS',
    query: 'Find a senior product manager with B2B SaaS, platform products and product-led growth experience',
    expected: { titles: ['Senior Product Manager'], skills: ['B2B SaaS', 'platform products', 'product-led growth'], locations: [], mustHave: ['B2B SaaS', 'platform products'], niceToHave: ['product-led growth'] },
  },
  {
    id: 'program-manager-federal', family: 'product_program', label: 'Federal technical program manager',
    query: 'Find a technical program manager with federal programs, Agile delivery and PMP certification',
    expected: { titles: ['Technical Program Manager'], skills: ['federal programs', 'Agile delivery'], locations: [], mustHave: ['federal programs', 'Agile delivery', 'PMP certification'], neverInfer: ['program title proves PMP'] },
  },

  {
    id: 'senior-financial-analyst', family: 'finance', label: 'Senior financial analyst',
    query: 'Find a senior financial analyst with FP&A, forecasting, Excel and SaaS experience',
    expected: { titles: ['Senior Financial Analyst'], skills: ['FP&A', 'forecasting', 'Excel', 'SaaS'], locations: [], mustHave: ['FP&A', 'forecasting', 'Excel'], niceToHave: ['SaaS experience'] },
  },
  {
    id: 'technical-accountant', family: 'finance', label: 'Technical accountant — public company',
    query: 'Find a technical accountant with SEC reporting, US GAAP and public company experience',
    expected: { titles: ['Technical Accountant'], skills: ['SEC reporting', 'US GAAP'], locations: [], mustHave: ['SEC reporting', 'US GAAP', 'public company experience'] },
  },

  {
    id: 'supply-chain-manager', family: 'operations_supply_chain', label: 'Supply chain manager',
    query: 'Find a supply chain manager with S&OP, inventory planning and manufacturing experience',
    expected: { titles: ['Supply Chain Manager'], skills: ['S&OP', 'inventory planning', 'manufacturing'], locations: [], mustHave: ['S&OP', 'inventory planning', 'manufacturing experience'] },
  },
]

export const SEARCH_BENCHMARK_FAMILIES_V38 = Array.from(new Set(SEARCH_BENCHMARK_CORPUS_V38.map(item => item.family)))

export function searchBenchmarkByIdV38(id: string): SearchBenchmarkScenarioV38 | undefined {
  return SEARCH_BENCHMARK_CORPUS_V38.find(item => item.id === id)
}
