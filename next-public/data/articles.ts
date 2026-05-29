export type Article = { slug: string; title: string; description: string; keyword: string; tool: string; cta: string; category: string; sections: [string,string][]; bullets: string[]; strings: string[]; faq: [string,string][] };

export const articles: Article[] = [
  {
    "slug": "source-pack-methodology",
    "title": "The Source Pack Methodology: How Senior Sourcers Structure Hard Searches",
    "description": "A practical operating system for turning a messy req into search lanes, Boolean strings, evidence rules, and a repeatable sourcing plan.",
    "keyword": "sourcing strategy template",
    "tool": "/tools/jd-search-strategy",
    "cta": "Build a source pack",
    "category": "Methodology",
    "sections": [
      [
        "Direct answer",
        "A source pack is the artifact senior sourcers should build before they start blasting searches. It turns a vague req into a structured map: must-have signals, alternate titles, source lanes, donor companies, false positives, outreach angles, and stop rules. The point is simple: do not run one giant Boolean string and hope the market cooperates. Build lanes first, then test each lane like a hypothesis."
      ],
      [
        "Why single-string sourcing breaks",
        "A single Boolean string usually mixes too many ideas at once. It overweights job titles, underweights source context, and hides the reason a search is failing. A source pack separates the market into lanes: direct fit, adjacent titles, donor companies, open-source evidence, academic or community signals, and rediscovery. When a lane fails, you know what failed."
      ],
      [
        "The six pieces of a source pack",
        "A useful source pack contains the role summary, required evidence, nice-to-have evidence, target titles, source lanes, and false-positive filters. For a cleared DevSecOps search, one lane may target GovCon prime contractors. Another lane may target Kubernetes and Terraform evidence on GitHub. Another may target AWS GovCloud, RMF, ATO, NIST, and FedRAMP breadcrumbs."
      ],
      [
        "How to use it with a hiring manager",
        "A source pack makes the search visible. Instead of telling the hiring manager \u201cI searched LinkedIn,\u201d you can show the strict market, expanded market, where the signal was strong, where the pool collapsed, and which requirement should loosen first. This makes calibration less emotional and more evidence-based."
      ],
      [
        "SourcingOS workflow",
        "Paste the JD into the JD Strategy Tool, generate lanes, copy the Boolean strings, test the first lane, and save what worked. The private beta turns those lanes into a reusable project memory so the next similar search starts smarter."
      ]
    ],
    "bullets": [
      "Define the strict market first.",
      "Build 3\u20135 lanes instead of one giant search.",
      "Attach false-positive filters to every lane.",
      "Track what worked so it becomes project memory."
    ],
    "strings": [
      "(\"DevSecOps Engineer\" OR \"Platform Engineer\" OR \"Cloud Engineer\") AND (Kubernetes OR Terraform OR Docker) AND (\"AWS GovCloud\" OR FedRAMP OR RMF OR ATO)",
      "(\"Machine Learning Engineer\" OR \"MLOps Engineer\") AND (RAG OR embeddings OR \"vector database\") AND (Python OR PyTorch)",
      "(\"Registered Nurse\" OR RN) AND (ICU OR ER OR NICU OR \"acute care\") AND (BLS OR ACLS)"
    ],
    "faq": [
      [
        "Is a source pack just a Boolean string?",
        "No. The Boolean string is one output. The source pack is the search plan around it."
      ],
      [
        "Should every recruiter build one?",
        "For high-volume evergreen roles, maybe not. For hard-to-fill technical, cleared, healthcare, or AI roles, yes."
      ]
    ]
  },
  {
    "slug": "github-xray-sourcing",
    "title": "GitHub X-Ray Sourcing: Copy-Paste Search Patterns for Technical Recruiters",
    "description": "A senior-sourcer guide to using Google X-Ray and GitHub profile evidence for DevOps, AI/ML, security, cloud, and systems searches.",
    "keyword": "GitHub X-Ray sourcing",
    "tool": "/tools/xray-search",
    "cta": "Open the X-Ray Launcher",
    "category": "Technical Sourcing",
    "sections": [
      [
        "Direct answer",
        "GitHub X-Ray works when you stop searching for job titles and start searching for public technical evidence. The best searches combine source operator, location or profile language, and concrete tool signals like Kubernetes, Terraform, PyTorch, dbt, Airflow, or Rust."
      ],
      [
        "Why GitHub is useful",
        "GitHub is not a resume database. It is an evidence surface. A strong GitHub profile can show language history, repo ownership, public contributions, and project context. A weak profile can be mostly forks and tutorial repos. SourcingOS treats GitHub as evidence, not identity verification."
      ],
      [
        "How to avoid noisy results",
        "Avoid broad terms like software engineer unless paired with repos, topics, or specific tools. Add exclusions for tutorials, bootcamps, and awesome lists. Look for recent activity, owned repositories, topic tags, README quality, and whether the person has profile links to personal sites or email."
      ],
      [
        "Best first lanes",
        "Start with role evidence. For DevSecOps, search Kubernetes, Terraform, Helm, ArgoCD, GitHub Actions, AWS, and Linux. For AI/ML, search PyTorch, transformers, Hugging Face, embeddings, evals, and model serving. For data, search dbt, Airflow, Spark, Snowflake, and Databricks."
      ],
      [
        "SourcingOS workflow",
        "Use the X-Ray Launcher to build the search, then save the query into a source pack. In the beta cockpit, GitHub evidence can sit beside Stack Overflow and OpenAlex evidence in Candidate 360."
      ]
    ],
    "bullets": [
      "Search for evidence, not titles.",
      "Use role-specific tool clusters.",
      "Filter tutorial/fork noise.",
      "Pair GitHub with a second evidence source when possible."
    ],
    "strings": [
      "site:github.com \"Minneapolis\" (Kubernetes OR Terraform OR ArgoCD) -tutorial -awesome",
      "site:github.com (PyTorch OR \"Hugging Face\" OR transformers) (\"model serving\" OR MLOps)",
      "site:github.com (dbt OR Airflow OR Spark OR Snowflake) \"Data Engineer\""
    ],
    "faq": [
      [
        "Can I contact people from GitHub?",
        "Use only publicly provided professional contact paths and respect platform terms and privacy norms."
      ],
      [
        "Is GitHub enough to judge fit?",
        "No. It is evidence to investigate, not a hiring decision."
      ]
    ]
  },
  {
    "slug": "cybersecurity-boolean-strings",
    "title": "30 Boolean Search Strings for Cybersecurity Recruiters",
    "description": "Role-specific Boolean logic for ISSO, ISSM, SOC, RMF, AppSec, cloud security, pen testing, and cleared cyber roles.",
    "keyword": "cybersecurity recruiter boolean strings",
    "tool": "/tools/boolean-generator",
    "cta": "Generate cyber Boolean strings",
    "category": "Boolean Library",
    "sections": [
      [
        "Direct answer",
        "Cybersecurity sourcing fails when recruiters search for \u201ccybersecurity engineer\u201d and stop. Cyber is a family of roles. ISSO, SOC analyst, cloud security engineer, AppSec engineer, DFIR analyst, GRC specialist, and penetration tester require different signals."
      ],
      [
        "The title problem",
        "Cyber titles are inconsistent. An ISSO may appear as Information System Security Officer, IA Analyst, Cybersecurity Analyst, Security Control Assessor, or RMF Analyst. A cloud security engineer may not use the word cybersecurity at all."
      ],
      [
        "Certification noise",
        "CISSP can signal senior security knowledge, but it can also over-index toward managers and GRC professionals. For engineering roles, pair certifications with tools and operational evidence: SIEM, Splunk, EDR, Kubernetes, IAM, AWS, Terraform, SAST, DAST, Burp, Nmap, or Metasploit."
      ],
      [
        "Cleared cyber variations",
        "For GovCon, clearance text is a breadcrumb only. Search with TS/SCI, Secret, Public Trust, RMF, ATO, NIST, FedRAMP, DoD, and IC terms, but never treat public text as verified clearance."
      ],
      [
        "SourcingOS workflow",
        "BooleanOS includes curated cyber/RMF modes so you can generate a narrow, broad, and X-Ray version without rebuilding the logic each time."
      ]
    ],
    "bullets": [
      "Segment cyber roles before writing strings.",
      "Pair certifications with actual tools.",
      "Use RMF/ATO/FedRAMP for federal cyber.",
      "Add exclusions for students, trainers, and bootcamps."
    ],
    "strings": [
      "(ISSO OR \"Information System Security Officer\" OR \"IA Analyst\" OR \"RMF Analyst\") AND (RMF OR ATO OR NIST OR FedRAMP) NOT (student OR intern OR instructor)",
      "(\"SOC Analyst\" OR \"Security Operations\") AND (SIEM OR Splunk OR Sentinel OR QRadar OR EDR) NOT (sales OR trainer)",
      "(\"Application Security\" OR AppSec OR \"Product Security\") AND (SAST OR DAST OR Burp OR OWASP OR threat-modeling)"
    ],
    "faq": [
      [
        "Should I start with certifications?",
        "Only if the role truly requires them. For hands-on roles, tools and work context usually matter more."
      ],
      [
        "Can BooleanOS handle cleared variants?",
        "Yes, use the Cyber/RMF or Cleared DevSecOps preset."
      ]
    ]
  },
  {
    "slug": "cleared-devsecops-sourcing",
    "title": "How to Source Cleared DevSecOps Engineers",
    "description": "A GovCon sourcing playbook for TS/SCI, AWS GovCloud, Kubernetes, Terraform, RMF, ATO, NIST, FedRAMP, and secure delivery signals.",
    "keyword": "source cleared DevSecOps engineers",
    "tool": "/tools/boolean-generator",
    "cta": "Generate cleared DevSecOps strings",
    "category": "GovCon Sourcing",
    "sections": [
      [
        "Direct answer",
        "Cleared DevSecOps sourcing is hard because the best candidates often leave only partial public breadcrumbs. Your job is not to verify clearance from the open web. Your job is to build a high-signal search lane around secure delivery tools, federal delivery language, and GovCon donor companies, then verify details manually."
      ],
      [
        "The signal stack",
        "Start with DevSecOps and platform titles, then layer Kubernetes, Terraform, Docker, CI/CD, Linux, Python, Bash, Ansible, Helm, ArgoCD, and cloud infrastructure. Add GovCon context such as AWS GovCloud, Azure Government, RMF, ATO, NIST, FedRAMP, DoD, IC, SCIF, and contract delivery."
      ],
      [
        "Donor companies",
        "GovCon markets have talent-donor patterns. Booz Allen, Leidos, GDIT, CACI, SAIC, Peraton, ManTech, Lockheed Martin, Northrop Grumman, Raytheon, L3Harris, Palantir, and Anduril can all produce different slices of cleared technical talent."
      ],
      [
        "False positives",
        "Exclude help desk, desktop support, sales, trainer, bootcamp, student, and generic security awareness roles. DevSecOps searches get noisy fast if you do not separate hands-on infrastructure from compliance-only profiles."
      ],
      [
        "SourcingOS workflow",
        "Use BooleanOS for the first strings, X-Ray for GitHub and LinkedIn public surface, then use the private beta Candidate 360 to keep evidence, missing info, and verification questions separate."
      ]
    ],
    "bullets": [
      "Public clearance text is not verification.",
      "Search secure delivery evidence.",
      "Mine GovCon donor companies.",
      "Separate compliance profiles from hands-on platform engineers."
    ],
    "strings": [
      "(\"DevSecOps Engineer\" OR \"Platform Engineer\" OR \"Cloud Engineer\" OR SRE) AND (Kubernetes OR Terraform OR Docker OR \"CI/CD\") AND (\"AWS GovCloud\" OR \"Azure Government\" OR FedRAMP OR RMF OR ATO)",
      "site:github.com (Kubernetes OR Terraform OR Helm OR ArgoCD) (FedRAMP OR GovCloud OR DoD OR \"NIST\") -tutorial",
      "(\"TS/SCI\" OR \"Top Secret\" OR Secret) AND (Terraform OR Kubernetes OR \"AWS GovCloud\") AND (GDIT OR Leidos OR CACI OR SAIC OR Peraton)"
    ],
    "faq": [
      [
        "Can SourcingOS verify clearance?",
        "No. It treats clearance mentions as unverified breadcrumbs and requires manual verification."
      ],
      [
        "What should I loosen first?",
        "Usually title variants, then location, then nice-to-have tools. Do not loosen non-negotiable clearance requirements without HM approval."
      ]
    ]
  },
  {
    "slug": "linkedin-recruiter-alternatives",
    "title": "LinkedIn Recruiter Alternatives for Sourcers: Build a Modern Open-Web Stack",
    "description": "A practitioner-first look at replacing or supplementing LinkedIn Recruiter with free tools, open-web search, contact finders, and workflow systems.",
    "keyword": "LinkedIn Recruiter alternatives",
    "tool": "/directory",
    "cta": "Browse the tool directory",
    "category": "Tool Comparisons",
    "sections": [
      [
        "Direct answer",
        "LinkedIn Recruiter is still useful, but it should not be the only sourcing surface. A modern stack can combine Google X-Ray, GitHub, Stack Overflow, OpenAlex, contact finders, email tools, ATS rediscovery, and a workflow cockpit like SourcingOS."
      ],
      [
        "What LinkedIn still does well",
        "It has network reach, recruiter workflows, projects, and InMail. The problem is cost, competition, stale profiles, and the fact that many technical, academic, healthcare, or cleared candidates leave better evidence elsewhere."
      ],
      [
        "What to replace by function",
        "Replace search breadth with X-Ray and open-web sources. Replace technical evidence with GitHub and Stack Overflow. Replace research evidence with OpenAlex and Semantic Scholar. Replace contact discovery with a careful contact finder stack. Replace workflow memory with SourcingOS."
      ],
      [
        "Best alternative stacks",
        "For technical roles: GitHub + X-Ray + ContactOut or RocketReach + SourcingOS. For AI/ML: GitHub + Hugging Face + OpenAlex + SourcingOS. For GovCon: ClearanceJobs + Google X-Ray + donor company maps + SourcingOS. For healthcare: NPI/state registries + local market research + SourcingOS."
      ],
      [
        "SourcingOS workflow",
        "Use the public directory to compare tools by workflow, then use the private beta as the evidence and source-pack cockpit across tools."
      ]
    ],
    "bullets": [
      "Compare by workflow, not feature list.",
      "Map each replacement to a job LinkedIn performs.",
      "Do not rely on one network.",
      "Use SourcingOS to keep evidence and lanes organized."
    ],
    "strings": [
      "site:linkedin.com/in (\"Platform Engineer\" OR \"DevSecOps Engineer\") (Kubernetes OR Terraform) -jobs -hiring",
      "site:github.com (\"Machine Learning\" OR PyTorch OR transformers) (\"San Francisco\" OR Remote)",
      "site:openalex.org (\"natural language processing\" OR \"computer vision\")"
    ],
    "faq": [
      [
        "Should teams cancel LinkedIn Recruiter?",
        "Not automatically. The better question is which jobs you need LinkedIn to perform and what cheaper/open-web tools can cover the rest."
      ],
      [
        "Is SourcingOS a LinkedIn replacement?",
        "No. It is a workflow and evidence layer that can sit above multiple sources."
      ]
    ]
  }
];
