export type Tool = { id:string; name:string; category:string; description:string; bestFor:string; cost:string; sourcingOSFit:number };
export const tools: Tool[] = [
  {
    "id": "linkedin-recruiter",
    "name": "LinkedIn Recruiter",
    "category": "AI Sourcing",
    "description": "Network search, projects, InMail, and recruiter workflows. Strong network reach but expensive and crowded.",
    "bestFor": "Best for teams that still need LinkedIn-native workflow.",
    "cost": "Paid/varies",
    "sourcingOSFit": 79
  },
  {
    "id": "hireez",
    "name": "hireEZ",
    "category": "AI Sourcing",
    "description": "Open-web sourcing, outreach, rediscovery, and AI-assisted search.",
    "bestFor": "Best for teams that want broad aggregation and campaign workflows.",
    "cost": "Paid/varies",
    "sourcingOSFit": 86
  },
  {
    "id": "seekout",
    "name": "SeekOut",
    "category": "AI Sourcing",
    "description": "Talent intelligence, technical filters, diversity analytics, and enterprise search.",
    "bestFor": "Best for enterprise technical and strategic workforce teams.",
    "cost": "Paid/varies",
    "sourcingOSFit": 93
  },
  {
    "id": "juicebox-peoplegpt",
    "name": "Juicebox / PeopleGPT",
    "category": "AI Sourcing",
    "description": "Natural-language people search and fast candidate discovery.",
    "bestFor": "Best for quick AI-assisted sourcing workflows.",
    "cost": "Paid/varies",
    "sourcingOSFit": 75
  },
  {
    "id": "gem",
    "name": "Gem",
    "category": "ATS/CRM",
    "description": "CRM, sequencing, analytics, and nurture campaigns.",
    "bestFor": "Best for teams that need pipeline memory and outreach analytics.",
    "cost": "Paid/varies",
    "sourcingOSFit": 82
  },
  {
    "id": "ashby",
    "name": "Ashby",
    "category": "ATS/CRM",
    "description": "ATS, CRM, scheduling, analytics, and clean recruiting operations.",
    "bestFor": "Best for modern startup and growth TA teams.",
    "cost": "Paid/varies",
    "sourcingOSFit": 89
  },
  {
    "id": "greenhouse",
    "name": "Greenhouse",
    "category": "ATS/CRM",
    "description": "ATS with structured hiring and ecosystem integrations.",
    "bestFor": "Best for teams with mature interview processes.",
    "cost": "Paid/varies",
    "sourcingOSFit": 96
  },
  {
    "id": "lever",
    "name": "Lever",
    "category": "ATS/CRM",
    "description": "ATS + CRM with candidate pipeline and nurture features.",
    "bestFor": "Best for mid-market teams.",
    "cost": "Paid/varies",
    "sourcingOSFit": 78
  },
  {
    "id": "loxo",
    "name": "Loxo",
    "category": "ATS/CRM",
    "description": "Recruiting CRM, ATS, sourcing, and outreach in one platform.",
    "bestFor": "Best for agencies and search firms.",
    "cost": "Paid/varies",
    "sourcingOSFit": 85
  },
  {
    "id": "recruiterflow",
    "name": "Recruiterflow",
    "category": "ATS/CRM",
    "description": "Agency-focused CRM/ATS with outreach workflows.",
    "bestFor": "Best for staffing and agency workflows.",
    "cost": "Paid/varies",
    "sourcingOSFit": 92
  },
  {
    "id": "contactout",
    "name": "ContactOut",
    "category": "Contact Finder",
    "description": "Email and contact lookup with recruiter-oriented workflows.",
    "bestFor": "Best for personal email coverage in recruiting.",
    "cost": "Paid/varies",
    "sourcingOSFit": 74
  },
  {
    "id": "apollo",
    "name": "Apollo",
    "category": "Contact Finder",
    "description": "Large B2B contact database and sequencing platform.",
    "bestFor": "Best for work email and sales-style outbound workflows.",
    "cost": "Paid/varies",
    "sourcingOSFit": 81
  },
  {
    "id": "lusha",
    "name": "Lusha",
    "category": "Contact Finder",
    "description": "Contact enrichment and Chrome extension workflows.",
    "bestFor": "Best for quick contact lookups.",
    "cost": "Paid/varies",
    "sourcingOSFit": 88
  },
  {
    "id": "rocketreach",
    "name": "RocketReach",
    "category": "Contact Finder",
    "description": "Email and phone lookup across professional profiles.",
    "bestFor": "Best for broad contact enrichment.",
    "cost": "Paid/varies",
    "sourcingOSFit": 95
  },
  {
    "id": "hunter",
    "name": "Hunter",
    "category": "Contact Finder",
    "description": "Domain-based email discovery and verification.",
    "bestFor": "Best for company/domain email patterns.",
    "cost": "Paid/varies",
    "sourcingOSFit": 77
  },
  {
    "id": "swordfish",
    "name": "Swordfish",
    "category": "Contact Finder",
    "description": "Contact data with phone-oriented lookup emphasis.",
    "bestFor": "Best for phone-first sourcers.",
    "cost": "Paid/varies",
    "sourcingOSFit": 84
  },
  {
    "id": "clearancejobs",
    "name": "ClearanceJobs",
    "category": "Cleared/GovCon",
    "description": "Cleared talent marketplace and career platform.",
    "bestFor": "Best for verified cleared-candidate workflows, subject to platform rules.",
    "cost": "Paid/varies",
    "sourcingOSFit": 91
  },
  {
    "id": "dice",
    "name": "Dice",
    "category": "Job Board",
    "description": "Technology job board and resume database.",
    "bestFor": "Best for technical sourcing outside LinkedIn.",
    "cost": "Paid/varies",
    "sourcingOSFit": 73
  },
  {
    "id": "indeed-resume",
    "name": "Indeed Resume",
    "category": "Job Board",
    "description": "Resume database and job marketplace.",
    "bestFor": "Best for high-volume and active/semi-active talent.",
    "cost": "Paid/varies",
    "sourcingOSFit": 80
  },
  {
    "id": "github",
    "name": "GitHub",
    "category": "Technical Evidence",
    "description": "Open-source repositories, languages, topics, and public activity.",
    "bestFor": "Best for developer evidence and technical projects.",
    "cost": "Free",
    "sourcingOSFit": 87
  },
  {
    "id": "stack-overflow",
    "name": "Stack Overflow",
    "category": "Technical Evidence",
    "description": "Q&A reputation and tag evidence.",
    "bestFor": "Best for technical depth and problem-solving evidence.",
    "cost": "Free",
    "sourcingOSFit": 94
  },
  {
    "id": "openalex",
    "name": "OpenAlex",
    "category": "Open Web",
    "description": "Open scholarly graph of authors, works, institutions, and concepts.",
    "bestFor": "Best for researchers and applied scientists.",
    "cost": "Free",
    "sourcingOSFit": 76
  },
  {
    "id": "semantic-scholar",
    "name": "Semantic Scholar",
    "category": "Open Web",
    "description": "Academic paper discovery and author profiles.",
    "bestFor": "Best for AI/ML and research sourcing.",
    "cost": "Free",
    "sourcingOSFit": 83
  },
  {
    "id": "orcid",
    "name": "ORCID",
    "category": "Open Web",
    "description": "Researcher identifiers and academic profile linking.",
    "bestFor": "Best for identity disambiguation in research.",
    "cost": "Free",
    "sourcingOSFit": 90
  },
  {
    "id": "hugging-face",
    "name": "Hugging Face",
    "category": "Technical Evidence",
    "description": "Models, datasets, spaces, and ML community profiles.",
    "bestFor": "Best for AI/ML contributor sourcing.",
    "cost": "Free",
    "sourcingOSFit": 72
  },
  {
    "id": "npm",
    "name": "npm",
    "category": "Technical Evidence",
    "description": "JavaScript package ecosystem and maintainer signals.",
    "bestFor": "Best for frontend/full-stack OSS signals.",
    "cost": "Free",
    "sourcingOSFit": 79
  },
  {
    "id": "pypi",
    "name": "PyPI",
    "category": "Technical Evidence",
    "description": "Python package ecosystem and maintainer evidence.",
    "bestFor": "Best for Python/data/ML engineers.",
    "cost": "Free",
    "sourcingOSFit": 86
  },
  {
    "id": "docker-hub",
    "name": "Docker Hub",
    "category": "Technical Evidence",
    "description": "Container images and publisher signals.",
    "bestFor": "Best for DevOps and platform evidence.",
    "cost": "Free",
    "sourcingOSFit": 93
  },
  {
    "id": "npi-registry",
    "name": "NPI Registry",
    "category": "Healthcare",
    "description": "Public healthcare provider registry.",
    "bestFor": "Best for healthcare sourcing research and market mapping.",
    "cost": "Free",
    "sourcingOSFit": 75
  },
  {
    "id": "clinicaltrialsgov",
    "name": "ClinicalTrials.gov",
    "category": "Healthcare",
    "description": "Clinical studies, sponsors, investigators, and institutions.",
    "bestFor": "Best for clinical research sourcing.",
    "cost": "Free",
    "sourcingOSFit": 82
  },
  {
    "id": "pubmed",
    "name": "PubMed",
    "category": "Healthcare",
    "description": "Biomedical literature and author evidence.",
    "bestFor": "Best for clinical, pharma, and research talent.",
    "cost": "Free",
    "sourcingOSFit": 89
  },
  {
    "id": "nih-reporter",
    "name": "NIH RePORTER",
    "category": "Healthcare",
    "description": "NIH-funded research projects and investigators.",
    "bestFor": "Best for biomedical research talent mapping.",
    "cost": "Free",
    "sourcingOSFit": 96
  },
  {
    "id": "cisa-kev",
    "name": "CISA KEV",
    "category": "Cleared/GovCon",
    "description": "Known exploited vulnerabilities catalog.",
    "bestFor": "Best for cyber context and source-pack research, not direct candidate data.",
    "cost": "Paid/varies",
    "sourcingOSFit": 78
  },
  {
    "id": "nvd",
    "name": "NVD",
    "category": "Cleared/GovCon",
    "description": "Vulnerability database and security context.",
    "bestFor": "Best for cyber skill taxonomy and source-pack research.",
    "cost": "Paid/varies",
    "sourcingOSFit": 85
  },
  {
    "id": "arxiv",
    "name": "arXiv",
    "category": "Open Web",
    "description": "Preprint server for AI, ML, physics, and engineering research.",
    "bestFor": "Best for AI/ML and research sourcing.",
    "cost": "Free",
    "sourcingOSFit": 92
  },
  {
    "id": "crossref",
    "name": "Crossref",
    "category": "Open Web",
    "description": "Publication metadata infrastructure.",
    "bestFor": "Best for research evidence and author discovery.",
    "cost": "Free",
    "sourcingOSFit": 74
  },
  {
    "id": "zoominfo",
    "name": "ZoomInfo",
    "category": "Contact Finder",
    "description": "Enterprise contact and company data.",
    "bestFor": "Best for teams with larger data budgets.",
    "cost": "Paid/varies",
    "sourcingOSFit": 81
  },
  {
    "id": "snovio",
    "name": "Snov.io",
    "category": "Contact Finder",
    "description": "Email finding and outreach tools.",
    "bestFor": "Best for lightweight outreach workflows.",
    "cost": "Paid/varies",
    "sourcingOSFit": 88
  },
  {
    "id": "clay",
    "name": "Clay",
    "category": "Contact Finder",
    "description": "Data enrichment and automated research workflows.",
    "bestFor": "Best for custom enrichment waterfalls.",
    "cost": "Paid/varies",
    "sourcingOSFit": 95
  },
  {
    "id": "phenom",
    "name": "Phenom",
    "category": "AI Sourcing",
    "description": "Talent experience and AI recruiting platform.",
    "bestFor": "Best for enterprise talent experience.",
    "cost": "Paid/varies",
    "sourcingOSFit": 77
  },
  {
    "id": "eightfold",
    "name": "Eightfold",
    "category": "AI Sourcing",
    "description": "Talent intelligence and skills graph platform.",
    "bestFor": "Best for enterprise internal/external talent intelligence.",
    "cost": "Paid/varies",
    "sourcingOSFit": 84
  },
  {
    "id": "beamery",
    "name": "Beamery",
    "category": "ATS/CRM",
    "description": "Talent CRM and workforce intelligence.",
    "bestFor": "Best for enterprise relationship recruiting.",
    "cost": "Paid/varies",
    "sourcingOSFit": 91
  },
  {
    "id": "findem",
    "name": "Findem",
    "category": "AI Sourcing",
    "description": "Attribute-based talent search and intelligence.",
    "bestFor": "Best for enterprise sourcing strategy.",
    "cost": "Paid/varies",
    "sourcingOSFit": 73
  },
  {
    "id": "pin",
    "name": "Pin",
    "category": "AI Sourcing",
    "description": "AI sourcing and outreach workflows.",
    "bestFor": "Best for streamlined agentic sourcing.",
    "cost": "Paid/varies",
    "sourcingOSFit": 80
  },
  {
    "id": "manatal",
    "name": "Manatal",
    "category": "ATS/CRM",
    "description": "Recruiting software for agencies and SMBs.",
    "bestFor": "Best for lightweight ATS/CRM needs.",
    "cost": "Paid/varies",
    "sourcingOSFit": 87
  },
  {
    "id": "avature",
    "name": "Avature",
    "category": "ATS/CRM",
    "description": "Enterprise CRM/ATS and recruiting workflow platform.",
    "bestFor": "Best for highly configurable enterprise recruiting.",
    "cost": "Paid/varies",
    "sourcingOSFit": 94
  },
  {
    "id": "wellfound",
    "name": "Wellfound",
    "category": "Job Board",
    "description": "Startup talent marketplace.",
    "bestFor": "Best for startup and founder-adjacent roles.",
    "cost": "Paid/varies",
    "sourcingOSFit": 76
  },
  {
    "id": "built-in",
    "name": "Built In",
    "category": "Job Board",
    "description": "Tech community and job marketplace.",
    "bestFor": "Best for regional technical talent discovery.",
    "cost": "Paid/varies",
    "sourcingOSFit": 83
  },
  {
    "id": "doximity",
    "name": "Doximity",
    "category": "Healthcare",
    "description": "Healthcare professional network.",
    "bestFor": "Best for physician and clinician research.",
    "cost": "Paid/varies",
    "sourcingOSFit": 90
  },
  {
    "id": "state-licensing-boards",
    "name": "State Licensing Boards",
    "category": "Healthcare",
    "description": "Public licensure lookup sources by state.",
    "bestFor": "Best for healthcare credential research.",
    "cost": "Free",
    "sourcingOSFit": 72
  },
  {
    "id": "google-programmable-search",
    "name": "Google Programmable Search",
    "category": "Open Web",
    "description": "Custom search engine wrapper for targeted source searching.",
    "bestFor": "Best for repeatable X-Ray/source packs.",
    "cost": "Free",
    "sourcingOSFit": 79
  }
];
