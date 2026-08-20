import type { Metadata } from 'next'
import Link from 'next/link'
import { siteUrl } from '@/lib/site'

const title = '30 Boolean Search Strings for Cybersecurity Recruiters: Role-Specific Queries for 2026'
const description = 'Thirty recruiter-ready cybersecurity Boolean strings organized by work pattern: RMF and ISSO, SOC and detection, AppSec, cloud security, IAM, DFIR, security engineering, offensive security, GRC, and cleared cyber.'
const canonical = '/blog/cybersecurity-boolean-strings/'

export const metadata: Metadata = {
  title: '30 Cybersecurity Boolean Search Strings for Recruiters | 2026',
  description,
  alternates: { canonical },
  keywords: ['cybersecurity Boolean strings recruiters','cybersecurity recruiter search strings','ISSO Boolean search','SOC analyst Boolean string','AppSec Boolean search','cloud security recruiter Boolean'],
  openGraph: { title, description, type: 'article', url: canonical, publishedTime: '2026-06-26', modifiedTime: '2026-08-20', authors: ['Dan Larson'] },
  twitter: { card: 'summary_large_image', title, description },
}

const groups = [
  {
    name: 'RMF, ISSO, ISSM, and federal cyber',
    note: 'Use when the work centers on system authorization, controls, continuous monitoring, security documentation, or federal risk-management processes. Public clearance language remains a sourcing breadcrumb only.',
    strings: [
      '(ISSO OR "Information System Security Officer" OR "RMF Analyst") AND (RMF OR ATO OR NIST OR "800-53")',
      '(ISSM OR "Information System Security Manager") AND (RMF OR ATO OR eMASS OR NIST)',
      '("Security Control Assessor" OR SCA OR "Security Assessor") AND (RMF OR "NIST 800-53" OR ATO)',
      '("Cybersecurity Analyst" OR "Information Assurance" OR "IA Analyst") AND (eMASS OR RMF OR POA&M OR SSP)',
    ],
  },
  {
    name: 'SOC, detection, and security operations',
    note: 'Separate detection and incident work from generic “cybersecurity analyst” searches by requiring SIEM, EDR, detection engineering, or response context.',
    strings: [
      '("SOC Analyst" OR "Security Operations Analyst") AND (Splunk OR Sentinel OR QRadar OR SIEM)',
      '("Detection Engineer" OR "Detection Engineering") AND (Sigma OR YARA OR Splunk OR Sentinel OR KQL)',
      '("Security Engineer" OR "SOC Engineer") AND (EDR OR CrowdStrike OR Defender OR SentinelOne) AND (SIEM OR detection)',
      '("Incident Responder" OR "Incident Response" OR DFIR) AND (EDR OR forensics OR malware OR containment)',
    ],
  },
  {
    name: 'Application and product security',
    note: 'AppSec searches work better when code-review, threat-modeling, SAST/DAST, or secure-development evidence appears with the title family.',
    strings: [
      '("Application Security Engineer" OR AppSec OR "Product Security Engineer") AND (SAST OR DAST OR OWASP OR Burp)',
      '("Product Security" OR AppSec) AND ("threat modeling" OR "threat model" OR STRIDE OR abuse-cases)',
      '("Application Security" OR "Software Security") AND (Semgrep OR CodeQL OR Snyk OR Checkmarx OR Veracode)',
      '("Security Engineer" OR AppSec) AND (Python OR Java OR Go OR JavaScript) AND (OWASP OR SAST OR "secure coding")',
    ],
  },
  {
    name: 'Cloud and platform security',
    note: 'Pair cloud names with infrastructure, identity, policy, or container context so the query does not become a generic cloud-engineering search.',
    strings: [
      '("Cloud Security Engineer" OR "Cloud Security") AND (AWS OR Azure OR GCP) AND (IAM OR CSPM OR KMS)',
      '("Platform Security Engineer" OR "Infrastructure Security") AND (Kubernetes OR Terraform) AND (OPA OR Kyverno OR IAM OR secrets)',
      '("Container Security" OR "Kubernetes Security") AND (Kubernetes OR EKS OR AKS OR GKE) AND (Falco OR OPA OR Trivy OR admission)',
      '("DevSecOps Engineer" OR "Security Platform Engineer") AND (Terraform OR Kubernetes) AND (SAST OR SCA OR secrets OR "policy as code")',
    ],
  },
  {
    name: 'IAM, identity, and access security',
    note: 'IAM titles are inconsistent, so combine identity platforms and protocol evidence with the operating context.',
    strings: [
      '("IAM Engineer" OR "Identity Engineer" OR "Identity Access Management") AND (Okta OR Entra OR "Azure AD" OR SailPoint)',
      '("Identity Security" OR IAM) AND (SAML OR OIDC OR OAuth OR SCIM) AND (Okta OR Entra OR Ping)',
      '("PAM Engineer" OR "Privileged Access") AND (CyberArk OR BeyondTrust OR Delinea)',
    ],
  },
  {
    name: 'DFIR, forensics, and malware',
    note: 'Use evidence terms that distinguish investigation and forensic depth from broad security-operations profiles.',
    strings: [
      '(DFIR OR "Digital Forensics" OR "Forensic Analyst") AND (EnCase OR FTK OR Volatility OR memory-forensics)',
      '("Malware Analyst" OR "Reverse Engineer") AND (Ghidra OR IDA OR x64dbg OR YARA)',
      '("Incident Response" OR DFIR) AND (Volatility OR Velociraptor OR KAPE OR forensic) AND (Windows OR Linux)',
    ],
  },
  {
    name: 'Offensive security and penetration testing',
    note: 'Keep offensive testing separate from vulnerability-management and compliance profiles.',
    strings: [
      '("Penetration Tester" OR pentester OR "Red Team") AND (Burp OR Cobalt-Strike OR Metasploit OR Nmap)',
      '("Red Team Operator" OR "Offensive Security Engineer") AND (C2 OR "command and control" OR phishing OR lateral-movement)',
      '("Web Application Penetration Tester" OR "Web Pentester") AND (Burp OR OWASP OR SQLi OR XSS)',
    ],
  },
  {
    name: 'Security engineering and architecture',
    note: 'Search for systems and design evidence when the role owns controls, platforms, or architecture rather than monitoring queues.',
    strings: [
      '("Security Architect" OR "Cybersecurity Architect") AND (zero-trust OR segmentation OR IAM OR cloud-security)',
      '("Security Engineer" OR "Cybersecurity Engineer") AND (Python OR Go OR Terraform) AND (automation OR detection OR hardening)',
      '("Network Security Engineer" OR "Security Network Engineer") AND (Palo-Alto OR Fortinet OR firewall OR IDS OR IPS)',
    ],
  },
  {
    name: 'GRC and security compliance',
    note: 'GRC is a different work pattern from hands-on security engineering. Keep it as its own lane unless the requisition explicitly combines them.',
    strings: [
      '("GRC Analyst" OR "Security Compliance Analyst" OR "Risk Analyst") AND (NIST OR ISO-27001 OR SOC-2 OR controls)',
      '("Third Party Risk" OR TPRM OR "Vendor Risk") AND (security OR cybersecurity) AND (assessment OR controls)',
    ],
  },
  {
    name: 'Cleared cyber variants',
    note: 'These strings search public clearance-related language together with role evidence. Current status requires the appropriate authorized process.',
    strings: [
      '("TS/SCI" OR "Top Secret" OR Secret OR polygraph) AND (ISSO OR ISSM OR "RMF Analyst") AND (RMF OR ATO)',
      '("TS/SCI" OR Secret OR polygraph) AND ("SOC Analyst" OR "Detection Engineer" OR "Incident Responder") AND (Splunk OR Sentinel OR EDR)',
      '("TS/SCI" OR Secret OR polygraph) AND ("DevSecOps Engineer" OR "Platform Security Engineer") AND (Kubernetes OR Terraform)',
    ],
  },
] as const

const faq = [
  ['What is the best Boolean string for cybersecurity recruiting?', 'There is no universal string because cybersecurity contains distinct work patterns. Start by identifying the work role, then build a title lane, a skill or tool lane, and an evidence lane. Keep SOC, AppSec, IAM, DFIR, cloud security, RMF, offensive security, and GRC separate until the requisition proves they should overlap.'],
  ['Why should cybersecurity recruiters use the NICE Framework?', 'The NICE Framework provides a common language for describing cybersecurity work through Work Roles, Tasks, Knowledge, and Skills. It is useful for role calibration because work-role names are not intended to be synonymous with job titles.'],
  ['Should I require a cybersecurity certification in the Boolean string?', 'Only when the requisition truly requires it. Certifications can be useful evidence, but they should not replace the work pattern, tools, and environment the person must actually know.'],
  ['How do I reduce false positives?', 'Add a second role-specific evidence signal before adding more title restrictions. For example, pair AppSec with SAST/DAST or threat modeling, SOC with SIEM/EDR, and RMF roles with ATO, eMASS, SSP, POA&M, or NIST context.'],
  ['Can I use clearance keywords in public search?', 'Yes as sourcing breadcrumbs when appropriate, but do not present public clearance wording as current-status confirmation. Handle current status through the organization’s authorized security and hiring process.'],
] as const

export default function CyberBooleanPage() {
  const articleUrl = `${siteUrl}${canonical}`
  const articleSchema = {
    '@context':'https://schema.org','@type':'Article',headline:title,description,url:articleUrl,mainEntityOfPage:articleUrl,
    datePublished:'2026-06-26',dateModified:'2026-08-20',author:{'@type':'Person',name:'Dan Larson',url:`${siteUrl}/about/`},
    publisher:{'@type':'Organization',name:'SourcingOS',url:siteUrl},about:['Cybersecurity recruiting','Boolean search','NICE Framework','Technical sourcing'],
  }
  const faqSchema = {'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))}

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(articleSchema)}} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(faqSchema)}} />
    <main className="wrap article article-pro">
      <div className="article-hero-card">
        <span className="kicker">Cybersecurity recruiting · Boolean library</span>
        <h1>{title}</h1>
        <p className="muted" style={{fontSize:13,margin:'4px 0 12px'}}>Dan Larson · Senior Technical Sourcer · Published June 26, 2026 · Updated August 20, 2026</p>
        <p className="lead">Cybersecurity is not one talent pool. Use role-specific query families that follow the work, then debug each lane separately instead of forcing every cyber title, certification, and tool into one string.</p>
        <div className="article-meta-grid"><div><span>Library</span><strong>30 search strings</strong></div><div><span>Structure</span><strong>10 work patterns</strong></div><div><span>Tool</span><Link href="/tools/boolean-generator/">Generate variants</Link></div></div>
      </div>

      <div className="article-layout">
        <aside className="article-sidebar"><div className="mini-card"><span className="kicker">In this guide</span><a href="#answer">Short answer</a><a href="#framework">Role framework</a><a href="#library">30 strings</a><a href="#debug">Debugging</a><a href="#clearance">Clearance boundary</a><a href="#faq">FAQ</a></div><div className="mini-card"><span className="kicker">Rule</span><p>NIST NICE Work Roles describe groups of cybersecurity work. They are not the same thing as employer job titles.</p></div></aside>
        <article className="article-main">
          <section id="answer"><h2>The short answer</h2><p>Start by identifying the cybersecurity work pattern, not the word “cyber.” A SOC analyst, product-security engineer, RMF analyst, cloud-security engineer, IAM engineer, malware analyst, and penetration tester may all sit under the same security organization while needing completely different search evidence.</p></section>

          <section id="framework"><h2>Use the NICE Framework as a calibration aid, not a title dictionary</h2><p>NIST describes the NICE Workforce Framework for Cybersecurity as a common language for cybersecurity work built from Work Roles, Tasks, Knowledge, and Skills. Current NICE Framework Components continue to evolve, and NIST released Components v2.1.0 in December 2025. The practical recruiting lesson is simple: calibrate around the work to be performed, then translate that work into the title language your target market actually uses.</p><p><a href="https://www.nist.gov/news-events/news/2025/12/nice-releases-nice-framework-components-v210" target="_blank" rel="noreferrer noopener">NIST NICE Framework Components v2.1.0 ↗</a></p></section>

          <section id="library"><h2>30 cybersecurity Boolean strings</h2>{groups.map(group=><div key={group.name}><h3>{group.name}</h3><p>{group.note}</p>{group.strings.map(s=><pre key={s}>{s}</pre>)}</div>)}</section>

          <section className="article-callout" id="debug"><h2>Debug cyber searches by work signal</h2><ul><li><strong>Too small:</strong> remove exact title requirements before removing the tool, task, or environment evidence that defines the work.</li><li><strong>Too broad:</strong> add a second work signal such as SIEM + detection, Kubernetes + policy, or RMF + ATO.</li><li><strong>Wrong cyber family:</strong> split compliance, engineering, operations, and offensive work into separate lanes.</li><li><strong>Certification noise:</strong> move the certification to a secondary filter unless it is a true day-one requirement.</li><li><strong>Same people repeatedly:</strong> open an independent source lane rather than endlessly editing synonyms.</li></ul><p>For the general method, use <Link href="/blog/boolean-search-operators-for-recruiters/">Boolean Search for Recruiters in 2026</Link>.</p></section>

          <section id="clearance"><h2>Keep public clearance language in the breadcrumb lane</h2><p>Public profiles can contain words such as Secret, TS/SCI, polygraph, cleared, SCIF, or agency/program context. Those terms can help prioritize research when the requisition has a legitimate clearance requirement. They should remain labeled as public breadcrumbs until current status is handled through the appropriate authorized process.</p><p>For the broader search model, see <Link href="/blog/cleared-devsecops-sourcing/">How to Source Cleared DevSecOps Engineers</Link>.</p></section>

          <section><h2>Turn strings into a measured source pack</h2><p>Do not copy all 30 strings into one search. Choose the role family, build two or three archetypes, record the false positives, and compare what each lane adds. Store the logic in the <Link href="/blog/source-pack-methodology/">Source Pack Methodology</Link> and use <Link href="/blog/unique-contribution-rate/">Unique Contribution Rate</Link> when you want to know whether the next lane is actually expanding discovery.</p></section>

          <section id="faq"><h2>FAQ</h2>{faq.map(([q,a])=><div className="faq" key={q}><h3>{q}</h3><p>{a}</p></div>)}</section>
          <div className="cta"><strong>Generate role-specific variants:</strong> <Link href="/tools/boolean-generator/">open BooleanOS</Link>.</div>
        </article>
      </div>
    </main>
  </>
}
