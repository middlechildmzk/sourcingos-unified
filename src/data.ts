import type { Connector, SourcingMode } from './types';

export const sourcingModes: SourcingMode[] = ['Cleared / GovCon','Cybersecurity','Cloud / DevSecOps','Software Engineering','AI / ML','Data Engineering','Healthcare IT','General Technical'];
export const sampleJDs = [
  { id: 'cleared-devsecops', name: 'Cleared DevSecOps Engineer', mode: 'Cloud / DevSecOps' as SourcingMode, jd: `Senior DevSecOps Engineer supporting federal cloud modernization. Must have Kubernetes, Terraform, AWS GovCloud or Azure Government, CI/CD, Linux, container security, FedRAMP or NIST 800-53 exposure, and Secret or TS/SCI clearance eligibility. Preferred: Helm, GitHub Actions, ArgoCD, Python, Go, security automation, DoD or IC mission experience. Location: DC metro, Reston, Chantilly, Arlington, or remote with travel.` },
  { id: 'sa-ts-sci-frontend', name: 'San Antonio TS/SCI Front End', mode: 'Software Engineering' as SourcingMode, jd: `Front End Developer, mid-level. San Antonio TX, onsite 5 days/week. Active TS/SCI required. 7 years software development. 3 years recent front-end web design/development. Jira, Jenkins, GitLab, JavaScript, Node, Java, Ember, React, Angular, DevSecOps, microservices, containers, cloud, web application testing, UI/UX, wireframes, mockups. DoD classified environment, JBSA / Lackland / San Antonio cleared software market.` },
  { id: 'cyber-rmf', name: 'Cyber RMF Analyst', mode: 'Cybersecurity' as SourcingMode, jd: `Cybersecurity RMF analyst for federal program. Must understand NIST 800-53, ATO packages, eMASS, POA&M, vulnerability remediation, STIGs, ACAS/Nessus, policy documentation, and security control assessment. Secret clearance or public clearance mention preferred. Target titles include ISSO, Cybersecurity Analyst, Information System Security Officer, RMF Analyst.` },
  { id: 'ai-ml-platform', name: 'AI/ML Platform Engineer', mode: 'AI / ML' as SourcingMode, jd: `ML Platform Engineer with Python, PyTorch, model serving, Kubernetes, vector databases, RAG, MLOps, MLflow, Docker, cloud infrastructure, and production AI systems. Nice to have: Hugging Face, LangChain, LlamaIndex, GPU optimization, retrieval pipelines, embeddings, evaluation frameworks, and open-source model contributions.` },
  { id: 'data-engineer', name: 'Federal Data Engineer', mode: 'Data Engineering' as SourcingMode, jd: `Data Engineer supporting federal health and analytics systems. Must have Python, SQL, Airflow, Spark, Databricks or Snowflake, data pipelines, AWS, and stakeholder communication. Preferred: FHIR, HL7, HIPAA, public trust, visualization, dbt, and government consulting experience.` }
];
export const modeKeywordSeeds: Record<SourcingMode, string[]> = {
  'Cleared / GovCon': ['clearance','dod','federal','govcloud','nist','rmf','fedramp','mission','public trust','ts/sci','top secret','jbsa'],
  'Cybersecurity': ['security','rmf','nist','stig','acas','nessus','siem','incident response','vulnerability','cve'],
  'Cloud / DevSecOps': ['kubernetes','terraform','aws','azure','devsecops','ci/cd','docker','helm','linux','argo','govcloud','jenkins','gitlab'],
  'Software Engineering': ['javascript','typescript','react','angular','ember','node','java','api','microservices','frontend','front-end','ui/ux','gitlab','jenkins','containers','cloud','devsecops'],
  'AI / ML': ['python','pytorch','tensorflow','mlops','huggingface','rag','llm','vector database','langchain','embeddings'],
  'Data Engineering': ['python','spark','airflow','dbt','snowflake','databricks','sql','etl','fivetran'],
  'Healthcare IT': ['epic','hl7','fhir','ehr','healthcare','hipaa','clinical','npi'],
  'General Technical': ['software','cloud','data','security','api','automation','systems']
};
export const titleSeeds: Record<SourcingMode, string[]> = {
  'Cleared / GovCon': ['Systems Engineer','Software Engineer','Cloud Engineer','DevSecOps Engineer','Cybersecurity Engineer','ISSO','ISSM'],
  'Cybersecurity': ['Cybersecurity Analyst','Security Engineer','ISSO','RMF Analyst','Security Control Assessor','Cyber Engineer'],
  'Cloud / DevSecOps': ['DevSecOps Engineer','Platform Engineer','Cloud Security Engineer','Site Reliability Engineer','Kubernetes Engineer','Cloud Engineer'],
  'Software Engineering': ['Software Engineer','Front End Developer','Frontend Engineer','Full Stack Engineer','Application Developer','UI Engineer','JavaScript Developer'],
  'AI / ML': ['ML Engineer','ML Platform Engineer','Applied AI Engineer','MLOps Engineer','AI Infrastructure Engineer'],
  'Data Engineering': ['Data Engineer','Analytics Engineer','ETL Developer','Data Platform Engineer','BI Engineer'],
  'Healthcare IT': ['Healthcare Integration Engineer','Epic Analyst','Clinical Systems Analyst','FHIR Developer','Healthcare Data Engineer'],
  'General Technical': ['Technical Specialist','Engineer','Developer','Analyst','Architect']
};
export const govConCompanies = ['Maximus','GDIT','Leidos','Booz Allen Hamilton','SAIC','CACI','Peraton','ManTech','Northrop Grumman','Lockheed Martin','RTX','L3Harris','BAE Systems','Palantir','Anduril','Accenture Federal','Jacobs','Parsons','Amentum','Deloitte'];
export const connectors: Connector[] = [
  { id:'github', name:'GitHub Public API', status:'connected', category:'Technical evidence', safeUse:'Public repos, languages, topics, profile metadata, recent repo activity, owner profile links.', guardrail:'Evidence only. Do not infer job intent, protected traits, or clearance.', source:'github', priority:'P0' },
  { id:'stackoverflow', name:'Stack Overflow / Stack Exchange API', status:'connected', category:'Technical evidence', safeUse:'Public top users, reputation, badges, tags, and profile links.', guardrail:'Evidence only. Reputation is not job intent.', source:'stackoverflow', priority:'P0' },
  { id:'openalex', name:'OpenAlex Authors API', status:'connected', category:'Research evidence', safeUse:'Author metadata, works, concepts, institution hints, and citation signals.', guardrail:'Confirm identity before merging research profiles.', source:'openalex', priority:'P0' },
  { id:'huggingface', name:'Hugging Face Hub', status:'live_ready', category:'AI/ML evidence', safeUse:'Public model, dataset, and space evidence for AI/ML roles.', guardrail:'Evidence only. Confirm identity before merge.', source:'huggingface', priority:'P0' },
  { id:'npm', name:'npm Registry', status:'live_ready', category:'Package evidence', safeUse:'Public package ownership, versions, README keywords, and JS ecosystem signals.', guardrail:'Package ownership requires manual identity confirmation.', source:'npm', priority:'P0' },
  { id:'pypi', name:'PyPI JSON API', status:'live_ready', category:'Package evidence', safeUse:'Python package metadata for data, ML, and backend roles.', guardrail:'Package evidence is not employment intent.', source:'pypi', priority:'P0' },
  { id:'orcid', name:'ORCID Public API', status:'live_ready', category:'Research identity', safeUse:'Public researcher identity and works metadata.', guardrail:'Use as identity evidence only when profile confirms ORCID.', source:'orcid', priority:'P0' },
  { id:'semantic-scholar', name:'Semantic Scholar API', status:'live_ready', category:'Research evidence', safeUse:'Author and paper evidence for research-heavy roles.', guardrail:'Publication evidence is not job intent.', source:'semantic_scholar', priority:'P0' },
  { id:'dblp', name:'DBLP', status:'live_ready', category:'Research evidence', safeUse:'Computer science publication evidence.', guardrail:'Name collisions common. Manual confirmation required.', source:'dblp', priority:'P0' },
  { id:'dockerhub', name:'Docker Hub', status:'planned', category:'Container evidence', safeUse:'Public container image evidence when available through allowed APIs/manual URLs.', guardrail:'Org accounts are common. Confirm identity.', source:'dockerhub', priority:'P0' },
  { id:'nvd', name:'NVD / CVE', status:'live_ready', category:'Cyber evidence', safeUse:'Vulnerability/security research evidence.', guardrail:'Evidence only, not identity verification.', source:'nvd', priority:'P1' },
  { id:'cisa-kev', name:'CISA KEV', status:'live_ready', category:'Cyber evidence', safeUse:'Known exploited vulnerability context for cyber roles.', guardrail:'Context source, not a candidate database.', source:'cisa_kev', priority:'P1' },
  { id:'crossref', name:'Crossref', status:'live_ready', category:'Research evidence', safeUse:'Publication metadata and DOI evidence.', guardrail:'Manual identity confirmation required.', source:'crossref', priority:'P1' },
  { id:'arxiv', name:'arXiv', status:'live_ready', category:'AI/ML research', safeUse:'Preprint evidence for ML, AI, security, and research roles.', guardrail:'Not job intent.', source:'arxiv', priority:'P1' },
  { id:'npi', name:'NPI Registry', status:'live_ready', category:'Healthcare identity', safeUse:'Provider records for healthcare roles.', guardrail:'Healthcare credential data requires careful relevance review.', source:'npi', priority:'P2' },
  { id:'clinicaltrials', name:'ClinicalTrials.gov', status:'live_ready', category:'Clinical research evidence', safeUse:'Public trial investigators, organizations, and study domains.', guardrail:'Do not infer employment interest.', source:'clinicaltrials', priority:'P2' },
  { id:'pubmed', name:'PubMed / NCBI', status:'live_ready', category:'Research evidence', safeUse:'Publication evidence for healthcare/research roles.', guardrail:'Publication evidence is not job intent.', source:'pubmed', priority:'P2' },
  { id:'nih-reporter', name:'NIH RePORTER', status:'planned', category:'Research funding evidence', safeUse:'Public grant/funding evidence with manual identity confirmation.', guardrail:'Manual identity confirmation required.', source:'nih_reporter', priority:'P2' },
  { id:'linkedin', name:'LinkedIn', status:'manual_only', category:'Profile review', safeUse:'Manual Recruiter workflow and manually pasted profile text only.', guardrail:'No scraping or automation.', source:'manual', priority:'manual' },
  { id:'clearancejobs', name:'ClearanceJobs', status:'manual_only', category:'Cleared sourcing', safeUse:'Manual review inside authorized user workflow.', guardrail:'No scraping. Clearance must be verified through approved process.', source:'manual', priority:'manual' },
  { id:'indeed', name:'Indeed', status:'manual_only', category:'Job-board intelligence', safeUse:'Manual market intelligence and role/title calibration.', guardrail:'No automated scraping or profile extraction.', source:'manual', priority:'manual' },
  { id:'avature', name:'Avature', status:'planned', category:'ATS/CRM', safeUse:'Future authorized internal connector after credentials/procurement.', guardrail:'Do not import sensitive fields without review.', source:'manual', priority:'manual' }
];
