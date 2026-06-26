export type Article = { slug: string; title: string; description: string; keyword: string; tool: string; cta: string; category: string; sections: [string,string][]; bullets: string[]; strings: string[]; faq: [string,string][]; author?: string; publishedAt?: string; updatedAt?: string };

const author = 'Dan — Senior Technical Sourcer'
const date = '2026-06-26'
const article = (a: Article): Article => ({ author, publishedAt: date, updatedAt: date, ...a })

export const articles: Article[] = [
  article({
    slug: 'source-pack-methodology',
    title: 'The Source Pack Methodology: How Senior Sourcers Structure Hard Searches',
    description: 'A practical operating system for turning a messy req into search lanes, Boolean strings, evidence rules, and a repeatable sourcing plan.',
    keyword: 'sourcing strategy template', tool: '/tools/jd-search-strategy', cta: 'Build a source pack', category: 'Methodology',
    sections: [
      ['Direct answer','A source pack is the artifact senior sourcers should build before they start running searches. It turns a vague req into must-have signals, adjacent titles, donor companies, source lanes, false-positive filters, outreach angles, and stop rules.'],
      ['Why single-string sourcing breaks','One giant Boolean string hides the reason a search is failing. Source packs separate the market into lanes so you can test direct-fit profiles, adjacent titles, donor companies, public technical evidence, academic evidence, and rediscovery one lane at a time.'],
      ['What belongs in the pack','A good pack includes the role summary, strict evidence, flexible evidence, target titles, adjacent titles, companies, public surfaces, clearance or license caveats, and hiring manager calibration questions.'],
      ['How to use it with a hiring manager','Bring the source pack to calibration. Show the strict market, the expanded market, where the pool collapsed, and which tradeoff would increase yield first.'],
      ['SourcingOS workflow','Use the JD Strategy Tool to build lanes, BooleanOS to generate strings, and Candidate Search to keep public evidence and recruiter confirmation separate.']
    ],
    bullets: ['Define the strict market first.','Build 3 to 5 lanes instead of one giant search.','Attach false-positive filters to every lane.','Track what worked so it becomes project memory.'],
    strings: ['("DevSecOps Engineer" OR "Platform Engineer") AND (Kubernetes OR Terraform OR Docker) AND (FedRAMP OR RMF OR ATO)','("Machine Learning Engineer" OR "MLOps Engineer") AND (RAG OR embeddings OR "vector database") AND (Python OR PyTorch)','("Registered Nurse" OR RN) AND (ICU OR ER OR NICU) AND (BLS OR ACLS)'],
    faq: [['Is a source pack just a Boolean string?','No. The Boolean string is one output. The source pack is the search plan around it.'],['Should every recruiter build one?','For high-volume evergreen roles, maybe not. For hard-to-fill technical, cleared, healthcare, or AI roles, yes.']]
  }),
  article({
    slug: 'github-xray-sourcing',
    title: 'GitHub X-Ray Sourcing: Copy-Paste Search Patterns for Technical Recruiters',
    description: 'A senior-sourcer guide to using Google X-Ray and GitHub profile evidence for DevOps, AI/ML, security, cloud, and systems searches.',
    keyword: 'GitHub X-Ray sourcing', tool: '/tools/xray-search', cta: 'Open the X-Ray Launcher', category: 'Technical Sourcing',
    sections: [['Direct answer','GitHub X-Ray works when you stop searching for job titles and start searching for public technical evidence.'],['Why GitHub is useful','GitHub is not a resume database. It is an evidence surface that can show public projects, repos, language patterns, contribution history, and links to other public profiles.'],['How to avoid noise','Avoid broad title terms unless they are paired with tools, repos, topics, or location language. Exclude tutorials, bootcamps, forks, and awesome lists when they overwhelm the results.'],['Best first lanes','For DevSecOps, start with Kubernetes, Terraform, Helm, ArgoCD, GitHub Actions, AWS, and Linux. For AI/ML, start with PyTorch, transformers, Hugging Face, embeddings, evals, and model serving.'],['SourcingOS workflow','Use the X-Ray Launcher to create the search, then save the lane into a source pack. Candidate Search keeps source evidence separate from recruiter-confirmed identity.']],
    bullets: ['Search for evidence, not titles.','Use role-specific tool clusters.','Filter tutorial and fork noise.','Pair GitHub with a second evidence source when possible.'],
    strings: ['site:github.com "Minneapolis" (Kubernetes OR Terraform OR ArgoCD) -tutorial -awesome','site:github.com (PyTorch OR "Hugging Face" OR transformers) ("model serving" OR MLOps)','site:github.com (dbt OR Airflow OR Spark OR Snowflake) "Data Engineer"'],
    faq: [['Can I contact people from GitHub?','Use only publicly provided professional contact paths and respect platform terms and privacy norms.'],['Is GitHub enough to judge fit?','No. It is evidence to investigate, not a hiring decision.']]
  }),
  article({
    slug: 'cybersecurity-boolean-strings',
    title: '30 Boolean Search Strings for Cybersecurity Recruiters',
    description: 'Role-specific Boolean logic for ISSO, ISSM, SOC, RMF, AppSec, cloud security, pen testing, and cleared cyber roles.',
    keyword: 'cybersecurity recruiter boolean strings', tool: '/tools/boolean-generator', cta: 'Generate cyber Boolean strings', category: 'Boolean Library',
    sections: [['Direct answer','Cybersecurity sourcing fails when recruiters search for cybersecurity engineer and stop. Cyber is a family of roles, not one keyword.'],['The title problem','ISSO, ISSM, SOC analyst, RMF analyst, AppSec engineer, cloud security engineer, and DFIR analyst need different search lanes.'],['Certification noise','Certifications help, but they need tool context. Pair CISSP, Security Plus, CEH, or GIAC with SIEM, EDR, IAM, AWS, Terraform, Burp, OWASP, Nmap, or Metasploit.'],['Cleared cyber variations','For GovCon, clearance language is an unverified breadcrumb only. Search the terms, but verify status directly through the proper process.'],['SourcingOS workflow','BooleanOS can generate narrow, broad, and X-Ray versions so you can test the market without rebuilding logic each time.']],
    bullets: ['Segment cyber roles before writing strings.','Pair certifications with actual tools.','Use RMF and ATO terms for federal cyber.','Add exclusions for students, trainers, and bootcamps.'],
    strings: ['(ISSO OR "Information System Security Officer" OR "IA Analyst" OR "RMF Analyst") AND (RMF OR ATO OR NIST OR FedRAMP)','("SOC Analyst" OR "Security Operations") AND (SIEM OR Splunk OR Sentinel OR QRadar OR EDR)','("Application Security" OR AppSec OR "Product Security") AND (SAST OR DAST OR Burp OR OWASP OR threat-modeling)'],
    faq: [['Should I start with certifications?','Only if the role truly requires them. For hands-on roles, tools and work context usually matter more.'],['Can BooleanOS handle cleared variants?','Yes, use the Cyber or Cleared DevSecOps mode.']]
  }),
  article({
    slug: 'cleared-devsecops-sourcing',
    title: 'How to Source Cleared DevSecOps Engineers',
    description: 'A GovCon sourcing playbook for TS/SCI, AWS GovCloud, Kubernetes, Terraform, RMF, ATO, NIST, FedRAMP, and secure delivery signals.',
    keyword: 'source cleared DevSecOps engineers', tool: '/tools/boolean-generator', cta: 'Generate cleared DevSecOps strings', category: 'GovCon Sourcing',
    sections: [['Direct answer','Cleared DevSecOps sourcing is hard because the best candidates often leave partial public breadcrumbs. Your job is not to verify clearance from the open web. Your job is to build a high-signal search lane and verify manually.'],['The signal stack','Layer platform tools, secure delivery language, GovCloud terms, RMF, ATO, NIST, FedRAMP, DoD, IC, SCIF, and donor-company context.'],['Donor companies','GovCon searches need donor maps. Different primes and subcontractors produce different slices of cleared technical talent.'],['False positives','Exclude help desk, desktop support, sales, trainer, bootcamp, student, and compliance-only profiles when the role needs hands-on infrastructure.'],['SourcingOS workflow','Use BooleanOS and X-Ray to build lanes, then use Candidate Search to keep evidence, missing details, and verification questions separate.']],
    bullets: ['Public clearance text is not verification.','Search secure delivery evidence.','Mine GovCon donor companies.','Separate compliance profiles from hands-on platform engineers.'],
    strings: ['("DevSecOps Engineer" OR "Platform Engineer" OR SRE) AND (Kubernetes OR Terraform OR Docker) AND ("AWS GovCloud" OR FedRAMP OR RMF OR ATO)','site:github.com (Kubernetes OR Terraform OR Helm OR ArgoCD) (FedRAMP OR GovCloud OR DoD OR NIST) -tutorial','("TS/SCI" OR "Top Secret" OR Secret) AND (Terraform OR Kubernetes OR "AWS GovCloud") AND (GDIT OR Leidos OR CACI OR SAIC OR Peraton)'],
    faq: [['Can SourcingOS verify clearance?','No. It treats clearance mentions as unverified breadcrumbs and requires manual verification.'],['What should I loosen first?','Usually title variants, then location, then nice-to-have tools. Do not loosen non-negotiable clearance requirements without approval.']]
  }),
  article({
    slug: 'linkedin-recruiter-alternatives',
    title: 'LinkedIn Recruiter Alternatives for Sourcers: Build a Modern Open-Web Stack',
    description: 'A practitioner-first look at replacing or supplementing LinkedIn Recruiter with free tools, open-web search, contact finders, and workflow systems.',
    keyword: 'LinkedIn Recruiter alternatives', tool: '/directory', cta: 'Browse the tool directory', category: 'Tool Comparisons',
    sections: [['Direct answer','LinkedIn Recruiter is still useful, but it should not be the only sourcing surface. A modern stack combines X-Ray, GitHub, OpenAlex, contact finders, ATS rediscovery, and a workflow cockpit.'],['What LinkedIn still does well','It has network reach, recruiter workflows, projects, and InMail. The problem is cost, competition, stale profiles, and missing technical evidence.'],['What to replace by function','Replace search breadth with X-Ray, technical evidence with GitHub, research evidence with OpenAlex, contact discovery with a careful contact finder stack, and workflow memory with SourcingOS.'],['Best alternative stacks','Technical roles need GitHub plus X-Ray. AI/ML needs GitHub plus Hugging Face plus OpenAlex. GovCon needs ClearanceJobs plus donor maps. Healthcare needs registries and local market research.'],['SourcingOS workflow','Use the directory to compare tools by workflow, then use Candidate Search as the evidence and source-pack cockpit across tools.']],
    bullets: ['Compare by workflow, not feature list.','Map each replacement to a job LinkedIn performs.','Do not rely on one network.','Use SourcingOS to keep evidence organized.'],
    strings: ['site:linkedin.com/in ("Platform Engineer" OR "DevSecOps Engineer") (Kubernetes OR Terraform) -jobs -hiring','site:github.com ("Machine Learning" OR PyTorch OR transformers) ("San Francisco" OR Remote)','site:openalex.org ("natural language processing" OR "computer vision")'],
    faq: [['Should teams cancel LinkedIn Recruiter?','Not automatically. The better question is which jobs you need LinkedIn to perform.'],['Is SourcingOS a LinkedIn replacement?','No. It is a workflow and evidence layer that can sit above multiple sources.']]
  }),
  article({
    slug: 'best-contact-finders-for-recruiters-2026',
    title: 'Best Contact Finders for Recruiters in 2026: ContactOut, Lusha, Apollo, Hunter, RocketReach and More',
    description: 'A recruiter-focused guide to choosing contact finder tools by coverage, compliance, workflow fit, phone data, email verification, and enrichment use case.',
    keyword: 'best contact finders for recruiters 2026', tool: '/directory', cta: 'Compare contact finders', category: 'Contact Data',
    sections: [['Direct answer','The best contact finder for a recruiter depends on the workflow. ContactOut is recruiter-native. Lusha and Apollo are stronger GTM data platforms. Hunter is excellent for email finding and verification. RocketReach, ZoomInfo, Seamless.AI, Snov.io, and SignalHire can all fit different coverage, budget, and phone-data needs.'],['How recruiters should evaluate contact tools','Do not compare contact finders by database-size claims alone. Test match rate on your real market, verify bounce rate, separate work email from personal email, check direct-dial quality, review compliance posture, and confirm whether the workflow respects your employer policies.'],['Best use-case buckets','For technical recruiting, prioritize GitHub and LinkedIn-adjacent workflows plus verification. For executive search, phone quality matters more. For agency recruiting, credit cost and bulk workflows matter. For enterprise TA, compliance, auditability, integrations, and permissioning matter.'],['The compliance lens','A contact finder should not become a spam engine. Use professional contact data carefully, verify before outreach, honor opt-outs, and avoid collecting or exporting private-source data you are not authorized to use.'],['SourcingOS workflow','Use SourcingOS to decide when contact enrichment is appropriate. Keep contact signals separate from identity evidence and require recruiter confirmation before outreach.']],
    bullets: ['Test tools on your actual reqs before buying.','Track email bounce rate and phone connect rate separately.','Do not treat enriched contact data as consent.','Use source notes and opt-out discipline.'],
    strings: ['("contact finder" OR "email finder") AND recruiter AND 2026','("ContactOut" OR Lusha OR Apollo OR RocketReach OR Hunter) recruiter contact data','("work email" OR "direct dial") AND (recruiter OR sourcer) AND compliance'],
    faq: [['What is the best contact finder for recruiters?','There is no universal winner. Recruiter-native workflows, market coverage, price, and compliance needs decide the best fit.'],['Should recruiters use personal emails?','Be careful. Many teams prefer professional email or platform-native outreach first. Always follow applicable law, employer policy, and opt-out norms.']]
  }),
  article({
    slug: 'ai-sourcing-workflow-2026',
    title: 'AI Sourcing Workflow in 2026: How Senior Sourcers Should Actually Use AI',
    description: 'A practical workflow for using AI to structure roles, build search lanes, audit evidence, and avoid fake candidate generation.',
    keyword: 'AI sourcing workflow 2026', tool: '/candidate-search', cta: 'Try Candidate Search', category: 'AI Sourcing',
    sections: [['Direct answer','The best use of AI in sourcing is not to replace the sourcer. It is to structure the search, expand the language, expose assumptions, and keep evidence visible.'],['Where AI helps most','AI is strongest at translating messy JDs, generating alternate titles, building source lanes, spotting false positives, and drafting HM calibration questions.'],['Where AI should not decide','AI should not verify clearance, infer identity merges, invent candidates, score protected characteristics, or auto-send outreach.'],['The human-in-the-loop model','Use AI to propose. Use recruiters to confirm. The model can build the map, but the sourcer owns the decision.'],['SourcingOS workflow','Candidate Search uses smart interpretation, source lanes, evidence drawers, and gated save actions so AI stays in the role of search copilot.']],
    bullets: ['Use AI before the search, not just after.','Separate search strategy from candidate judgment.','Keep every claim tied to evidence.','Never let AI invent profile details.'],
    strings: ['"AI sourcing" recruiter workflow 2026','("talent sourcing" OR recruiter) AND (AI OR automation) AND "human in the loop"','("candidate evidence" OR "source pack") AND recruiter'],
    faq: [['Can AI source candidates for me?','It can help you search and structure evidence, but a recruiter should confirm identity, relevance, and outreach decisions.'],['What is the biggest AI sourcing risk?','Treating generated summaries as facts without checking primary evidence.']]
  }),
  article({
    slug: 'candidate-360-profile-template',
    title: 'Candidate 360 Profile Template: Evidence, Gaps, Outreach Angles, and Recruiter Confirmation',
    description: 'A candidate profile framework that separates public evidence from recruiter-confirmed fit.',
    keyword: 'Candidate 360 profile template', tool: '/sample-candidate-360', cta: 'See a sample Candidate 360', category: 'Candidate 360',
    sections: [['Direct answer','A Candidate 360 profile should not be a scraped resume. It should be an evidence dossier that shows what is known, what is inferred, what is missing, and what the recruiter still needs to confirm.'],['Core sections','Include identity, source profiles, public evidence, role fit, missing information, risk flags, contact signals, outreach angle, and verification checklist.'],['Evidence rules','Every claim needs a source or a manual note. If it came from public data, label it public. If it is inferred, label it inferred. If it is verified, record who verified it.'],['Common mistakes','Do not merge profiles silently. Do not label clearance as verified from public text. Do not treat open-to-work signals as guaranteed intent.'],['SourcingOS workflow','The sample Candidate 360 shows how SourcingOS keeps synthetic demo data, public evidence, and recruiter confirmation clearly separated.']],
    bullets: ['Separate evidence from inference.','Keep missing info visible.','Require explicit merge confirmation.','Record verify-next steps.'],
    strings: ['"Candidate 360" recruiter template','"candidate profile" evidence recruiter','"recruiter confirmation" candidate profile'],
    faq: [['Is Candidate 360 the same as a resume?','No. It is a sourcing artifact that helps a recruiter evaluate evidence and next steps.'],['Should it include contact data?','Only when collected through authorized workflows and handled with opt-out discipline.']]
  }),
  article({
    slug: 'open-web-sourcing-stack',
    title: 'Open-Web Sourcing Stack: The Modern Sourcer Toolkit Beyond LinkedIn',
    description: 'How to combine X-Ray, GitHub, research databases, registries, contact tools, and ATS rediscovery into one sourcing workflow.',
    keyword: 'open web sourcing stack', tool: '/tools/xray-search', cta: 'Build an X-Ray search', category: 'Open-Web Sourcing',
    sections: [['Direct answer','An open-web sourcing stack combines multiple public evidence surfaces instead of relying on one network.'],['The stack layers','Use X-Ray for discovery, GitHub for technical evidence, OpenAlex or Semantic Scholar for research evidence, registries for healthcare, contact finders for professional contact paths, and ATS rediscovery for owned history.'],['Why this matters','Hard-to-fill candidates do not all express themselves in the same place. Engineers may show evidence on GitHub. Researchers may show evidence in papers. Clinicians may show evidence in licenses and registries.'],['Trust rules','Open-web does not mean anything goes. Respect terms, privacy, opt-outs, and manual-source boundaries.'],['SourcingOS workflow','SourcingOS helps keep the source lanes visible so you can show where the search worked and where it failed.']],
    bullets: ['Map the role to evidence surfaces.','Use at least two independent lanes.','Separate discovery from contact enrichment.','Save searches that produce signal.'],
    strings: ['site:github.com (Kubernetes OR Terraform) "Platform Engineer"','site:openalex.org "computer vision" "deep learning"','site:linkedin.com/in ("Data Engineer" OR "Analytics Engineer") (dbt OR Airflow)'],
    faq: [['Is open-web sourcing scraping?','Not inherently. It means using publicly accessible sources and respecting platform rules.'],['What is the best first lane?','For technical roles, usually GitHub plus X-Ray. For healthcare, registries and local market search.']]
  }),
  article({
    slug: 'hiring-manager-calibration-questions',
    title: 'Hiring Manager Calibration Questions for Hard-to-Fill Technical Roles',
    description: 'The exact questions sourcers should ask before building Boolean strings for technical, cleared, healthcare, and AI roles.',
    keyword: 'hiring manager calibration questions recruiters', tool: '/tools/jd-search-strategy', cta: 'Generate HM questions', category: 'Calibration',
    sections: [['Direct answer','Calibration should expose tradeoffs before sourcing begins. The best questions identify must-haves, evidence standards, title flexibility, donor companies, location constraints, compensation reality, and false positives.'],['The question sequence','Start with what success looks like, then ask what evidence proves it, then ask what can flex, then ask what profiles have failed before.'],['Technical roles','Ask which tools are truly required, which are interchangeable, and what project context proves skill.'],['Cleared roles','Ask which clearance level is required, whether crossover is possible, what location or onsite constraints are fixed, and what cannot be discussed publicly.'],['SourcingOS workflow','The JD Strategy Tool turns the role into calibration questions and search lanes before Candidate Search starts.']],
    bullets: ['Ask what evidence proves fit.','Ask what can flex.','Ask what failed before.','Ask which donor companies are realistic.'],
    strings: ['"hiring manager calibration" recruiter technical role','"intake questions" technical recruiter sourcing','"must have" "nice to have" recruiter calibration'],
    faq: [['How many questions should I ask?','Ask enough to separate non-negotiables from preferences. Ten focused questions can save days of wrong sourcing.'],['Should compensation be part of calibration?','Yes. Market reality is part of the search strategy.']]
  }),
  article({
    slug: 'talent-mapping-donor-companies',
    title: 'Talent Mapping Donor Companies: How Sourcers Build Market Maps That Actually Work',
    description: 'A donor-company mapping framework for GovCon, healthcare, AI/ML, data, cyber, and enterprise software recruiting.',
    keyword: 'talent mapping donor companies', tool: '/tools/jd-search-strategy', cta: 'Build a donor map', category: 'Talent Mapping',
    sections: [['Direct answer','A donor map is a prioritized list of companies likely to contain the exact talent pattern your role needs.'],['How to build one','Start with companies that share the domain, tech stack, customer type, compliance model, and delivery environment. Then split them into primary, adjacent, and stretch donors.'],['GovCon example','A cleared platform engineer search should map primes, subs, cloud vendors, and mission-tech companies differently because each produces different evidence and compensation expectations.'],['False positives','Do not assume every person at a donor company has the right skill. Donor maps guide where to look, not whom to hire.'],['SourcingOS workflow','Add donor companies to the source pack and use them as lanes, not just keywords.']],
    bullets: ['Map by environment, not brand prestige.','Split primary and adjacent donors.','Use donor maps to calibrate with HMs.','Update the map when the market pushes back.'],
    strings: ['("Platform Engineer" OR SRE) AND (Kubernetes OR Terraform) AND (Leidos OR GDIT OR CACI)','("Data Engineer" OR "Analytics Engineer") AND (Snowflake OR dbt) AND (Databricks OR Snowflake OR Fivetran)','("MLOps Engineer" OR "Machine Learning Engineer") AND (PyTorch OR Kubernetes) AND (OpenAI OR Anthropic OR Hugging Face)'],
    faq: [['Are donor companies enough?','No. They are a starting lane. You still need evidence.'],['Should I show donor maps to hiring managers?','Yes. It turns vague feedback into market-specific tradeoffs.']]
  }),
  article({
    slug: 'recruiter-ai-prompts-source-pack',
    title: 'Recruiter AI Prompts for Building Source Packs, Boolean Strings, and Evidence Checklists',
    description: 'Copy-paste AI prompts that help sourcers turn a role into search lanes without inventing candidates.',
    keyword: 'recruiter AI prompts sourcing', tool: '/tools/jd-search-strategy', cta: 'Generate a source strategy', category: 'AI Prompts',
    sections: [['Direct answer','The best recruiter prompts ask AI to structure the search, not to invent candidates.'],['Prompt pattern','Give the model the JD, ask for must-haves, adjacent titles, false positives, source lanes, Boolean strings, and hiring manager questions. Then require it to label assumptions.'],['Good guardrails','Tell the model not to invent people, not to verify clearance, not to claim contact accuracy, and not to recommend outreach without evidence.'],['Best outputs','Useful outputs include source pack, Boolean bank, X-Ray bank, donor map, scorecard, no-results rescue plan, and outreach angle.'],['SourcingOS workflow','Use prompts for strategy, then use SourcingOS tools to turn strategy into repeatable searches.']],
    bullets: ['Ask for assumptions explicitly.','Ask for false positives.','Ask for three search lanes.','Never ask AI to create fake candidate lists.'],
    strings: ['Prompt: Turn this JD into strict, adjacent, and exploratory sourcing lanes. Label assumptions.','Prompt: Build Boolean strings and false-positive filters for this role. Do not invent candidates.','Prompt: Generate hiring manager calibration questions based on missing evidence in this JD.'],
    faq: [['Can I paste resumes into AI?','Only follow your company policy and avoid exposing sensitive data unnecessarily.'],['What is the best AI prompt for sourcers?','The best prompt creates a source pack and asks the model to show uncertainty.']]
  }),
  article({
    slug: 'how-to-source-ai-ml-engineers',
    title: 'How to Source AI and Machine Learning Engineers: GitHub, Hugging Face, OpenAlex, and Evidence Signals',
    description: 'A modern AI/ML sourcing guide for recruiters looking beyond generic machine learning titles.',
    keyword: 'source AI ML engineers', tool: '/candidate-search', cta: 'Search AI/ML evidence', category: 'AI/ML Recruiting',
    sections: [['Direct answer','AI/ML sourcing works best when you search for evidence: frameworks, model work, papers, repos, evaluations, deployment context, and productized systems.'],['Signals that matter','Look for PyTorch, TensorFlow, transformers, embeddings, RAG, vector databases, model serving, evaluation, fine-tuning, CUDA, Triton, and production ML infrastructure.'],['Where to search','Use GitHub for code, Hugging Face for model and dataset evidence, OpenAlex for research, personal sites for project context, and LinkedIn for employment history.'],['False positives','Many profiles mention AI without production depth. Separate prompt-use, coursework, and tutorials from shipped ML systems.'],['SourcingOS workflow','Candidate Search can route AI/ML queries toward GitHub, Hugging Face, OpenAlex, npm, and PyPI lanes.']],
    bullets: ['Search frameworks plus deployment context.','Check recency and ownership of repos.','Pair research evidence with engineering evidence.','Verify production experience directly.'],
    strings: ['(PyTorch OR TensorFlow OR JAX) AND ("model serving" OR Triton OR Kubernetes OR "production ML")','site:huggingface.co (transformers OR embeddings OR "text generation")','site:github.com (RAG OR embeddings OR "vector database") (Python OR TypeScript)'],
    faq: [['Should I search for AI Engineer?','Yes, but pair it with specific evidence terms. Titles alone are noisy.'],['Is a paper enough evidence?','It can be strong research evidence, but confirm engineering and product context for production roles.']]
  }),
  article({
    slug: 'healthcare-recruiting-open-web',
    title: 'Healthcare Recruiting Open-Web Sourcing: Licenses, Registries, Local Markets, and EMR Signals',
    description: 'A practical open-web sourcing framework for healthcare recruiters working clinical and healthcare IT roles.',
    keyword: 'healthcare recruiting open web sourcing', tool: '/tools/jd-search-strategy', cta: 'Build healthcare source lanes', category: 'Healthcare Recruiting',
    sections: [['Direct answer','Healthcare sourcing needs structured evidence because titles, licenses, specialties, systems, and location rules all matter.'],['Clinical roles','Start with license and specialty signals, then local market, facility type, shift reality, and credential requirements.'],['Healthcare IT roles','Search Epic, Cerner, MEDITECH, HL7, FHIR, revenue cycle, Beaker, Ambulatory, Inpatient, and integration evidence.'],['False positives','Epic can be a normal word. RN can mean registered nurse or other abbreviations. Always verify context.'],['SourcingOS workflow','Use source packs to separate clinical evidence, healthcare IT systems, and local-market constraints.']],
    bullets: ['Separate clinical and healthcare IT lanes.','Verify license and specialty context.','Search EMR modules precisely.','Account for local market and shift constraints.'],
    strings: ['("Epic Analyst" OR "Epic Consultant") AND (Ambulatory OR Beaker OR Inpatient OR Willow)','("Registered Nurse" OR RN) AND (ICU OR ER OR NICU) AND (BLS OR ACLS)','("HL7" OR FHIR OR "interface analyst") AND (Epic OR Cerner OR MEDITECH)'],
    faq: [['Can open-web replace healthcare databases?','No. It can support discovery, but credential and compliance workflows still need authorized systems.'],['What is the biggest healthcare sourcing mistake?','Mixing clinical, IT, and administrative signals into one search lane.']]
  }),
  article({
    slug: 'boolean-search-operators-for-recruiters',
    title: 'Boolean Search Operators for Recruiters: The Advanced Guide for 2026',
    description: 'A senior-sourcer guide to Boolean operators, nesting, exclusions, X-Ray, proximity thinking, and search debugging.',
    keyword: 'Boolean search operators recruiters', tool: '/tools/boolean-generator', cta: 'Generate Boolean strings', category: 'Boolean Search',
    sections: [['Direct answer','Boolean search is not about writing the longest string. It is about controlling relevance, recall, and noise.'],['Core operators','Recruiters need AND, OR, quotes, parentheses, exclusions, site operators, intitle, inurl, and careful wildcard thinking depending on the search engine.'],['Advanced pattern','Write one strict string, one broad string, and one evidence string. Compare the results instead of endlessly editing one query.'],['Debugging','If the pool is tiny, remove title restrictions first. If the pool is noisy, add evidence terms or exclusions.'],['SourcingOS workflow','BooleanOS generates role-aware strict, broad, and X-Ray strings so sourcers can test lanes faster.']],
    bullets: ['Use parentheses deliberately.','Do not overuse titles.','Create strict and broad variants.','Debug with one change at a time.'],
    strings: ['("Platform Engineer" OR SRE) AND (Kubernetes OR Terraform) NOT (intern OR student OR trainer)','site:linkedin.com/in ("Data Engineer" OR "Analytics Engineer") (dbt OR Airflow OR Snowflake)','("Product Security" OR AppSec) AND (OWASP OR threat-modeling OR SAST OR DAST)'],
    faq: [['What is the most common Boolean mistake?','Over-restricting titles and missing adjacent profiles.'],['Should I use long strings?','Only when the role requires it. Short lane-specific strings are often easier to debug.']]
  }),
  article({
    slug: 'contact-enrichment-compliance-for-recruiters',
    title: 'Contact Enrichment Compliance for Recruiters: What to Verify Before Outreach',
    description: 'A cautious recruiter guide to contact enrichment, professional emails, direct dials, consent, opt-outs, and evidence separation.',
    keyword: 'contact enrichment compliance recruiters', tool: '/directory', cta: 'Review contact data tools', category: 'Compliance',
    sections: [['Direct answer','Contact enrichment should be treated as a gated workflow, not a default step. The recruiter should confirm relevance before enrichment and respect opt-outs before outreach.'],['What to verify','Verify identity, role fit, professional context, source provenance, and whether your team is allowed to use the contact source.'],['Email vs phone','Email match rate and direct-dial quality are different metrics. Track both separately and do not assume one tool is best for both.'],['Candidate respect','A contact record is not permission to spam. Use personalization, relevance, frequency limits, and opt-out handling.'],['SourcingOS workflow','SourcingOS separates evidence from contact signals and gates enrichment behind authenticated workflows.']],
    bullets: ['Confirm identity before enrichment.','Track bounce and connect rates.','Honor opt-outs.','Keep source provenance with the candidate record.'],
    strings: ['"contact enrichment" recruiter compliance','"professional email" candidate sourcing opt out','"direct dial" recruiter sourcing compliance'],
    faq: [['Should enrichment happen before fit review?','Usually no. Review fit first, then enrich only when outreach is appropriate.'],['Is a contact finder the same as consent?','No. Consent, lawful basis, and outreach policy are separate questions.']]
  }),
  article({
    slug: 'aging-req-rescue-framework',
    title: 'Aging Req Rescue Framework: How Senior Sourcers Diagnose Stuck Searches',
    description: 'A practical triage model for stuck roles, low yield, repeated rejections, unrealistic requirements, and stale search strategy.',
    keyword: 'aging req rescue sourcing', tool: '/tools/aging-req-rescue', cta: 'Run Aging Req Rescue', category: 'Req Rescue',
    sections: [['Direct answer','Aging reqs usually fail for one of five reasons: unclear evidence, impossible tradeoffs, wrong source lane, poor compensation reality, or stale feedback loops.'],['The first diagnostic','Ask whether candidates are missing, unqualified, uninterested, rejected, or stuck after submittal. Each failure mode needs a different fix.'],['Search lane rescue','If no candidates exist in the strict lane, test adjacent titles, donor companies, and evidence-first searches before declaring the role impossible.'],['Manager calibration rescue','If candidates are rejected, show the patterns. The HM may be applying a hidden standard that never made it into the intake.'],['SourcingOS workflow','Use the Aging Req Rescue tool to turn frustration into a diagnosis and next experiment.']],
    bullets: ['Separate no candidates from wrong candidates.','Look for hidden rejection patterns.','Test adjacent lanes.','Document the tradeoff recommendation.'],
    strings: ['("aging req" OR "hard to fill role") recruiter sourcing','("no candidates" OR "low yield") AND recruiter AND sourcing','("hiring manager" calibration AND sourcing strategy'],
    faq: [['When is a req truly impossible?','Usually only after strict, adjacent, donor, and compensation reality lanes have been tested.'],['What should I show the HM?','Show evidence, not excuses: pool size, lane results, rejection patterns, and tradeoff options.']]
  }),
  article({
    slug: 'sourcing-kpi-dashboard',
    title: 'Sourcing KPI Dashboard: Metrics That Actually Help Senior Sourcers Improve Searches',
    description: 'A KPI model for measuring source quality, search yield, evidence strength, conversion, aging req risk, and hiring manager feedback.',
    keyword: 'sourcing KPI dashboard', tool: '/tools/jd-search-strategy', cta: 'Build a sourcing plan', category: 'Sourcing Ops',
    sections: [['Direct answer','A good sourcing dashboard measures lane quality, not just activity.'],['Bad metrics','Raw profiles viewed, messages sent, and names added can reward noise. They do not show whether the search strategy is improving.'],['Better metrics','Track source lane yield, evidence strength, save rate, HM pass-through, response rate by outreach angle, rejection reason, and time-to-first-qualified-profile.'],['Strategic metrics','For leadership, show blocked req reasons, tradeoff patterns, market scarcity, and source lanes that repeat across roles.'],['SourcingOS workflow','SourcingOS can turn source packs, saved searches, and Candidate 360 outcomes into project memory.']],
    bullets: ['Measure quality by lane.','Track rejection reasons.','Separate activity from evidence.','Use metrics to change strategy.'],
    strings: ['"sourcing metrics" "source quality" recruiter','"time to first qualified candidate" sourcer','"hiring manager pass through" recruiter sourcing'],
    faq: [['What is the best sourcing metric?','Time to first qualified evidence-backed profile is more useful than raw outreach volume.'],['Should sourcers have KPIs?','Yes, but KPIs should reward search quality and learning, not spam.']]
  }),
  article({
    slug: 'ats-rediscovery-sourcing',
    title: 'ATS Rediscovery Sourcing: How to Turn Old Candidate Data Into New Source Packs',
    description: 'How sourcers can use owned candidate history, rejection reasons, and past outreach to build better searches without spamming old leads.',
    keyword: 'ATS rediscovery sourcing', tool: '/candidate-search', cta: 'Join Candidate Search beta', category: 'Rediscovery',
    sections: [['Direct answer','ATS rediscovery is one of the highest-leverage sourcing lanes because the organization already has context.'],['What to rediscover','Look for silver medalists, past finalists, candidates rejected for timing, candidates who lacked one skill then, and leads from similar reqs.'],['What to avoid','Do not blast stale candidates without context. Check recency, status, opt-outs, previous notes, and why the conversation ended.'],['Search strategy','Use past successful candidates to build title, company, skill, and location patterns for the new search.'],['SourcingOS workflow','Candidate Graph is designed to remember source evidence and make rediscovery more structured over time.']],
    bullets: ['Start with owned data.','Respect opt-outs and previous context.','Use history to improve new search lanes.','Do not treat old interest as current intent.'],
    strings: ['"ATS rediscovery" recruiter sourcing','"silver medalist" recruiting sourcing','"candidate rediscovery" talent acquisition'],
    faq: [['Is rediscovery just re-contacting old candidates?','No. It is using owned history to build better evidence and decide whom to re-engage carefully.'],['What is the biggest risk?','Ignoring old notes, opt-outs, or context.']]
  }),
  article({
    slug: 'source-profile-evidence-ledger',
    title: 'Source Profile Evidence Ledger: A Better Way to Review Public Candidate Signals',
    description: 'A framework for storing public profile evidence, missing information, confidence levels, and verification steps.',
    keyword: 'candidate evidence ledger sourcing', tool: '/sample-candidate-360', cta: 'View Candidate 360 sample', category: 'Evidence Review',
    sections: [['Direct answer','An evidence ledger is a structured record of why a profile might matter and what still needs to be verified.'],['What to log','Log source URL, evidence snippet, signal type, confidence, recency, missing info, and verify-next action.'],['Why it helps','It prevents the team from turning weak signals into strong claims. It also makes HM review more transparent.'],['What not to log','Do not store sensitive data you are not authorized to use. Do not label inferred traits as facts.'],['SourcingOS workflow','Candidate 360 uses evidence-ledger thinking to keep public evidence visible and recruiter confirmation explicit.']],
    bullets: ['Log source and confidence.','Keep missing info visible.','Separate claims from inferences.','Use the ledger for HM review.'],
    strings: ['"candidate evidence" sourcing recruiter','"public profile" evidence ledger recruiter','"source profile" candidate review'],
    faq: [['Why not just paste profiles into notes?','Unstructured notes make it hard to audit claims and verify evidence.'],['Does evidence prove interest?','No. Public evidence is not job intent.']]
  }),
  article({
    slug: 'sourcing-for-founders-and-small-teams',
    title: 'Sourcing for Founders and Small Recruiting Teams: Build a Search System Before Buying More Tools',
    description: 'A lightweight sourcing system for teams that need hard-to-fill talent without a giant recruiting stack.',
    keyword: 'sourcing for founders recruiting', tool: '/tools/jd-search-strategy', cta: 'Build your first source pack', category: 'Founder Recruiting',
    sections: [['Direct answer','Small teams should build a sourcing system before buying more tools.'],['Minimum stack','You need a role intake, Boolean builder, X-Ray workflow, donor-company map, contact policy, and simple tracking.'],['Founder advantage','Founders can personalize outreach with company context, but only if the search is narrow enough to find the right people.'],['Where tools help','Tools should reduce manual research, not replace judgment. Buy contact data after the search strategy is working.'],['SourcingOS workflow','Use free tools to structure the search, then graduate to Candidate Search when you need projects and Candidate 360.']],
    bullets: ['Start with role clarity.','Use free tools first.','Personalize outreach.','Track every search lane.'],
    strings: ['"founder recruiting" sourcing engineers','"startup recruiter" Boolean search engineer','"technical sourcer" startup source pack'],
    faq: [['Should founders buy LinkedIn Recruiter first?','Not always. Start with a source pack and open-web search to prove the market.'],['What is the first hire to source carefully?','Usually the role where title and skill mismatch will cost the most time.']]
  }),
  article({
    slug: 'govcon-cleared-sourcing-market-map',
    title: 'GovCon Cleared Sourcing Market Map: Donor Companies, Mission Language, and Verification Rules',
    description: 'A cleared recruiting market map for sourcers working defense, intelligence, cyber, cloud, and systems engineering roles.',
    keyword: 'GovCon cleared sourcing market map', tool: '/tools/clearance-search', cta: 'Build clearance search lanes', category: 'GovCon Sourcing',
    sections: [['Direct answer','GovCon sourcing is a market-map problem before it is a keyword problem.'],['Map the environment','Separate defense primes, intelligence contractors, cloud vendors, systems integrators, cyber shops, and mission-tech startups.'],['Map the language','Search program language, secure delivery, RMF, ATO, NIST, FedRAMP, GovCloud, ICD, SCIF, polygraph, and agency context carefully.'],['Verification rule','Public clearance language is always a breadcrumb. Active status must be verified through the appropriate process.'],['SourcingOS workflow','Use Clearance Search Builder for public breadcrumb strategy and Candidate Search for evidence separation.']],
    bullets: ['Build donor maps by mission.','Search secure delivery terms.','Do not verify clearance from public text.','Track which donor lanes perform.'],
    strings: ['("TS/SCI" OR polygraph OR "Full Scope") AND (Kubernetes OR Terraform OR AWS)','(RMF OR ATO OR NIST OR FedRAMP) AND ("Systems Engineer" OR "Cloud Engineer")','(SCIF OR "intelligence community" OR IC) AND (Python OR Linux OR cybersecurity)'],
    faq: [['Can I say SourcingOS finds cleared candidates?','Use careful language: it finds public clearance breadcrumbs for manual verification.'],['What is the best GovCon lane?','The best lane depends on mission, location, clearance level, and tech stack.']]
  }),
  article({
    slug: 'sourcing-tool-stack-for-agency-recruiters',
    title: 'Sourcing Tool Stack for Agency Recruiters: Fast, Cheap, Compliant, and Repeatable',
    description: 'A tool stack blueprint for agency recruiters balancing speed, cost, contact data, and candidate quality.',
    keyword: 'sourcing tool stack agency recruiters', tool: '/directory', cta: 'Browse the sourcing directory', category: 'Agency Recruiting',
    sections: [['Direct answer','Agency recruiters need a stack that moves fast without turning into spam.'],['Core stack','Use BooleanOS, X-Ray, GitHub or domain-specific evidence surfaces, one contact finder, an email verification tool, CRM notes, and a repeatable source pack.'],['Cost control','Track credits per qualified profile, not credits per lookup. A cheap contact tool is expensive if it creates bounces or bad outreach.'],['Quality control','Require evidence before enrichment. Keep outreach relevant and candidate-specific.'],['SourcingOS workflow','SourcingOS can sit above the stack as the role intake, source pack, and Candidate 360 layer.']],
    bullets: ['Measure cost per qualified profile.','Verify before sending.','Use one workflow layer.','Do not let speed destroy relevance.'],
    strings: ['"agency recruiter" sourcing tools contact finder','"recruiting agency" Boolean search toolkit','"candidate sourcing" agency recruiter workflow'],
    faq: [['What should agencies buy first?','Usually a contact finder plus a workflow system, but only after the search strategy is defined.'],['What kills agency sourcing quality?','Volume without evidence.']]
  }),
  article({
    slug: 'technical-sourcer-operating-system',
    title: 'Technical Sourcer Operating System: The Weekly Workflow for Senior Sourcers',
    description: 'A weekly operating rhythm for role intake, source packs, search testing, HM feedback, rediscovery, and pipeline review.',
    keyword: 'technical sourcer operating system', tool: '/candidate-search', cta: 'Try Candidate Search demo', category: 'Sourcer Workflow',
    sections: [['Direct answer','A technical sourcer operating system is the repeatable weekly rhythm that keeps hard searches from turning into random activity.'],['Monday','Review active reqs, classify risk, refresh source packs, and pick the highest-leverage lane for each role.'],['Midweek','Run search experiments, log evidence, and request HM feedback quickly before weak assumptions harden.'],['Friday','Review rejections, response rates, lane yield, and what should change next week.'],['SourcingOS workflow','Use SourcingOS to keep searches, evidence, and lessons tied to the role instead of scattered across notes.']],
    bullets: ['Run experiments, not random searches.','Review HM feedback weekly.','Preserve what worked.','Let market evidence change the plan.'],
    strings: ['"technical sourcer" workflow operating system','"source pack" "technical sourcer"','"sourcing strategy" weekly recruiter workflow'],
    faq: [['How often should source packs update?','Weekly for active hard-to-fill roles.'],['What is the biggest operating mistake?','Letting every role become a fresh blank-page search.']]
  }),
  article({
    slug: 'candidate-search-ui-smart-composer',
    title: 'Smart Candidate Search UX: Why Sourcers Need Search Interpretation, Not Just a Text Box',
    description: 'How smart typeahead, entity recognition, chips, source lanes, and trust notes make sourcing search faster and safer.',
    keyword: 'candidate search UX smart typeahead', tool: '/candidate-search', cta: 'Try smart Candidate Search', category: 'Product Strategy',
    sections: [['Direct answer','A sourcing search box should understand what the sourcer is trying to build: title, skill, location, clearance, source lane, exclusion, and evidence type.'],['Why normal search boxes fail','A plain text box treats TS/SCI, Kubernetes, San Antonio, React, and Booz Allen as equal tokens. Sourcers need the system to classify those signals differently.'],['What smart assist should do','It should recognize entities as you type, recommend additions, route to better source lanes, warn about clearance and open-to-work interpretation, and let the sourcer press Enter when ready.'],['Trust rules','Search assist should not invent candidates. It should only help shape the query and explain why certain lanes or terms matter.'],['SourcingOS workflow','SourcingOS Candidate Search includes smart interpretation, selectable suggestions, chips, and source-lane recommendations so the sourcer can search faster without losing control.']],
    bullets: ['Recognize signal types.','Suggest adjacent terms.','Keep manual-safe warnings visible.','Let Enter run the search.'],
    strings: ['"candidate search" typeahead recruiter','"smart search" talent sourcing','"entity recognition" recruiting search'],
    faq: [['Should the search box auto-run?','Only when it is clear and reversible. Sourcers need control.'],['What is the best UX pattern?','Recognize and suggest while typing, then let the user choose terms or press Enter.']]
  }),
  article({
    slug: 'hard-to-fill-role-intake-template',
    title: 'Hard-to-Fill Role Intake Template for Technical and Cleared Recruiting',
    description: 'A role intake template that captures must-haves, evidence, disqualifiers, tradeoffs, donor companies, and verification rules.',
    keyword: 'hard to fill role intake template', tool: '/tools/jd-search-strategy', cta: 'Generate role intake questions', category: 'Role Intake',
    sections: [['Direct answer','A hard-to-fill role intake should define evidence, tradeoffs, and verification rules before the search starts.'],['Required fields','Capture role outcome, must-have skills, proof of skill, title flexibility, location rules, clearance or license requirements, disqualifiers, compensation, donor companies, and review criteria.'],['Tradeoff fields','Ask what can flex: title, years, domain, location, tech stack, compensation, industry, and clearance crossover.'],['Verification fields','Ask what must be confirmed manually: clearance status, license, onsite eligibility, work authorization, recency of skill, and current interest.'],['SourcingOS workflow','Paste a JD into the strategy tool and use the output as the starting intake template.']],
    bullets: ['Define evidence before search.','Capture tradeoffs explicitly.','List disqualifiers.','Write verification rules.'],
    strings: ['"hard to fill role" intake template recruiter','"technical recruiter" intake template sourcing','"cleared role" intake questions recruiter'],
    faq: [['What is the most important intake question?','What evidence proves this person can do the job?'],['Should intake include disqualifiers?','Yes. Disqualifiers prevent wasted search time.']]
  }),
  article({
    slug: 'best-ai-recruiting-tools-for-sourcers-2026',
    title: 'Best AI Recruiting Tools for Sourcers in 2026: What to Automate and What to Keep Human',
    description: 'A practical buyer guide for AI recruiting tools focused on sourcing strategy, candidate discovery, matching, outreach, analytics, and compliance.',
    keyword: 'best AI recruiting tools for sourcers 2026', tool: '/directory', cta: 'Browse sourcing tools', category: 'AI Recruiting Tools',
    sections: [['Direct answer','The best AI recruiting tools help sourcers structure searches, find evidence, summarize profiles, improve outreach, and learn from feedback. The worst tools hide the evidence or pretend to verify things they cannot verify.'],['Evaluation criteria','Look for evidence visibility, human approval, source provenance, permissions, audit trail, integration with your workflow, and measurable lift in qualified profiles.'],['What to automate','Automate role parsing, title expansion, query generation, source-lane suggestions, duplicate detection suggestions, and draft outreach angles.'],['What to keep human','Keep candidate relevance, identity merge confirmation, clearance verification, sensitive outreach, and final fit decisions human-owned.'],['SourcingOS workflow','SourcingOS is built around AI as a source-pack copilot and evidence layer, not a black-box recruiter.']],
    bullets: ['Reward evidence visibility.','Avoid black-box verification claims.','Keep final decisions human.','Measure qualified-profile lift.'],
    strings: ['"AI recruiting tools" sourcers 2026','"AI sourcing tool" recruiter evidence','"human in the loop" AI recruiting'],
    faq: [['What should AI not do in recruiting?','It should not invent candidates, verify clearance, or auto-send outreach without recruiter approval.'],['How should teams measure AI sourcing tools?','Measure qualified evidence-backed profiles, pass-through rate, and time saved.']]
  })
];
