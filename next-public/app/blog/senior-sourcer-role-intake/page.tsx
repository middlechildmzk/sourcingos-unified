import type { Metadata } from 'next'
import Link from 'next/link'
import { siteUrl } from '@/lib/site'

const title = "The Senior Sourcer's Role Intake: 25 Questions That Change the Search"
const description = 'Hiring-manager intake questions built around search evidence, title flexibility, skill substitution, donor companies, geography, compensation, verification, and rejection patterns.'
const canonical = '/blog/senior-sourcer-role-intake/'

export const metadata: Metadata = {
  title: '25 Hiring Manager Intake Questions That Actually Change the Search',
  description,
  alternates: { canonical },
  keywords: ['hiring manager intake questions','recruiter intake meeting questions','role intake template','sourcing intake questions','kickoff meeting recruiting','hiring manager calibration'],
  openGraph: { title, description, type:'article', url:canonical, publishedTime:'2026-08-15', modifiedTime:'2026-08-15', authors:['SourcingOS Editorial'] },
  twitter: { card:'summary_large_image', title, description },
}

const groups = [
  ['Evidence: what proof would convince you', [
    ['1. If you could only see one artifact from a candidate, what would tell you the most?', 'Changes the evidence lane you prioritize: code, architecture, a system they operated, research, writing, or another job-relevant artifact.'],
    ['2. What does someone in this role produce in their first 90 days?', 'Moves the keyword set from credentials toward outcomes and work products.'],
    ['3. What would you ask in the first five minutes of a technical screen?', 'Often exposes the real must-have that the job description buried.'],
    ['4. Show me a resume or profile you would say yes to immediately.', 'Creates a concrete calibration anchor instead of another abstract description.'],
    ['5. What detail tells you someone actually did the work rather than watched it happen?', 'Identifies differentiating evidence and false-positive filters.'],
  ]],
  ['Title flexibility', [
    ['6. What else do other companies call this role?', 'Expands the direct title set.'],
    ['7. What was the last successful person in this role titled before joining?', 'Creates an adjacent-title lane from real history.'],
    ['8. Is the title negotiable if the person is right?', 'Clarifies title and seniority flexibility before search filters harden.'],
    ['9. Would you consider someone one level below who is already doing most of the work?', 'Tests whether seniority is evidence-based or merely inherited from the requisition.'],
  ]],
  ['Skill substitution', [
    ['10. Which requirement would you trade for the right person?', 'Separates true AND conditions from preferences and OR groups.'],
    ['11. What is the closest technology or skill that transfers?', 'Creates the adjacent-skill lane.'],
    ['12. How long would it take a strong person to learn the missing skill here?', 'Tests whether a requirement belongs in search or onboarding.'],
    ['13. What can they absolutely not learn on the job?', 'Defines the short list of hard filters.'],
  ]],
  ['Donor companies and environment', [
    ['14. Which companies have produced your strongest people?', 'Seeds a donor-company map from team history.'],
    ['15. Which companies do you tend to lose people to?', 'Adds competitive employers and informs positioning.'],
    ['16. Are there employers we should not source from?', 'Surfaces company policy, customer, contractual, or non-solicit constraints before the search.'],
    ['17. What kind of environment must someone have worked in to succeed here?', 'Turns scale, regulation, pace, complexity, or operating context into market-map criteria.'],
  ]],
  ['Adjacent backgrounds', [
    ['18. What non-obvious background has worked here before?', 'Opens an evidence-backed adjacent lane.'],
    ['19. Which other industry is closest enough that a strong person could transfer?', 'Tests whether industry is a hard boundary or a proxy for some deeper experience.'],
  ]],
  ['Geography and structure', [
    ['20. What is the actual onsite requirement, in days, confirmed by someone who can commit to it?', 'Turns vague “hybrid” language into a usable geographic constraint.'],
    ['21. If the right person lived outside the current radius, what would have to be true?', 'Tests whether geographic expansion is a real lane or a dead end.'],
  ]],
  ['Compensation', [
    ['22. What did the most recent comparable hire actually land at, total compensation?', 'Calibrates how the approved range behaves in the real market.'],
    ['23. What happens if the strongest candidate is above the current range?', 'Determines whether compensation is a hard stop or a calibration conversation.'],
  ]],
  ['Eligibility and verification', [
    ['24. What is the exact job-related eligibility, license, or clearance requirement, and who is authorized to confirm it?', 'Defines which lanes are viable and separates public breadcrumbs from formal verification.'],
  ]],
  ['Rejection patterns', [
    ['25. Tell me about the last three candidates the team passed on. What specifically caused each no?', 'Turns actual decision history into screening and search criteria.'],
  ]],
] as const

const faq = [
  ['How long should a sourcing intake meeting take?', 'The useful length depends on role complexity and preparation. Send the evidence and calibration questions in advance, then spend meeting time resolving tradeoffs rather than rereading the job description.'],
  ['What if the hiring manager will not give me much time?', 'Start with questions 4, 10, 14, 20, and 25: a strong example, tradeable requirements, donor companies, real location rules, and recent rejection reasons.'],
  ['What if the hiring manager says “I know it when I see it”?', 'Ask for recent yes/no examples and rejection reasons. Concrete decisions expose the operating threshold better than another abstract requirement list.'],
  ['Should I redo intake on an aging requisition?', 'Usually run a calibration check instead: bring a yes, no, and maybe profile and ask the hiring manager to explain each decision. Then update the search parameters that changed.'],
  ['Does this work for cleared and federal roles?', 'Yes, but keep clearance or other eligibility verification inside the authorized security or compliance process. Public clearance language is an unverified sourcing breadcrumb, not proof.'],
] as const

export default function SeniorSourcerRoleIntakePage(){
 const articleUrl=`${siteUrl}${canonical}`
 const articleSchema={'@context':'https://schema.org','@type':'Article',headline:title,description,url:articleUrl,mainEntityOfPage:articleUrl,datePublished:'2026-08-15',dateModified:'2026-08-15',author:{'@type':'Person',name:'SourcingOS Editorial',url:`${siteUrl}/about/`},publisher:{'@type':'Organization',name:'SourcingOS',url:siteUrl},about:['Hiring manager intake','Role intake','Talent sourcing','Recruiter calibration']}
 const faqSchema={'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))}
 return <>
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(articleSchema)}} />
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(faqSchema)}} />
  <main className="wrap article article-pro">
   <div className="article-hero-card"><span className="kicker">Role intake & calibration</span><h1>{title}</h1><p className="muted" style={{fontSize:13,margin:'4px 0 12px'}}>SourcingOS Editorial · Senior Technical Sourcer · Published August 15, 2026</p><p className="lead">{description}</p><div className="article-meta-grid"><div><span>Framework</span><strong>25 search-relevant questions</strong></div><div><span>Output</span><strong>Titles · skills · evidence · companies · geography</strong></div><div><span>Next action</span><Link href="/tools/jd-search-strategy/">Build the search plan</Link></div></div></div>
   <div className="article-layout">
    <aside className="article-sidebar"><div className="mini-card"><span className="kicker">In this guide</span><a href="#answer">Short answer</a><a href="#definition">Search-relevant intake</a><a href="#questions">25 questions</a><a href="#calibration">Follow-up calibration</a><a href="#boundaries">Legal & safety boundaries</a><a href="#research">Research plan</a><a href="#faq">FAQ</a></div><div className="mini-card"><span className="kicker">Operating test</span><p>If an intake answer would not change a title, keyword, evidence lane, company map, geography, or screening threshold, ask whether it belongs in the sourcing intake at all.</p></div></aside>
    <article className="article-main">
     <section id="answer"><h2>The short answer</h2><p>A useful sourcing intake does not simply collect a cleaner version of the job description. It converts hiring-manager knowledge into search parameters. Each question should change the title set, keyword logic, donor-company map, geography, evidence type, seniority band, verification owner, or screening threshold.</p></section>
     <section id="definition"><h2>Definition: search-relevant intake</h2><p><strong>Search-relevant intake</strong> is a requisition kickoff where each question maps to a specific, changeable search parameter. It differs from descriptive intake, which gathers useful role context without necessarily changing how the market is searched. The test is simple: what changes in the search because of this answer?</p></section>
     <section id="questions"><h2>The 25 questions</h2>{groups.map(([group,qs])=><div key={group}><h3>{group}</h3>{qs.map(([q,why])=><div key={q} style={{marginBottom:18}}><p><strong>{q}</strong></p><p>{why}</p></div>)}</div>)}</section>
     <section className="article-callout" id="calibration"><h2>The follow-up that makes intake useful</h2><p>After the search has produced real market evidence, return with three profiles: a yes, a no, and a maybe. Ask the hiring manager to explain the decision. Intake captures what the team believes it wants; calibration reveals what it actually responds to. Update the search parameters rather than letting new rejection logic stay implicit.</p></section>
     <section id="boundaries"><h2>Keep intake job-related</h2><p>The U.S. Equal Employment Opportunity Commission advises that pre-employment information requests should be limited to information essential to determining whether a person is qualified for the job, and it restricts disability-related inquiries before a conditional offer. Keep intake focused on job-related capability, work requirements, and lawful eligibility criteria; follow applicable law and your employer’s policies. <a href="https://www.eeoc.gov/prohibited-employment-policiespractices" target="_blank" rel="noreferrer">Review the EEOC’s current guidance →</a></p><p>For cleared roles, do not ask anyone to describe classified work. Keep sourcing at unclassified, job-relevant scope, and route clearance verification through the authorized security process.</p></section>
     <section><h2>Use occupation evidence to challenge title assumptions</h2><p><a href="https://www.onetonline.org/" target="_blank" rel="noreferrer">O*NET OnLine</a> publishes occupation tasks, reported job titles, skills, and related occupations. It can help a sourcer test whether the title on a requisition is narrower than the underlying work and generate evidence-backed adjacent-title questions.</p></section>
     <section id="research"><h2>Pre-registered research plan</h2><p>We have not ranked these 25 questions by measured impact. The validation study will instrument at least 15 role intakes, record which answers changed a search parameter within one week, and compare calibration speed and first-submittal acceptance between fuller and partial intakes. Any future “highest-impact questions” ranking will be published only with the sample size and collection window.</p></section>
     <section><h2>Turn the answers into a search</h2><p>Use the <Link href="/tools/jd-search-strategy/">JD Search Strategy tool</Link> to convert intake into title sets, keyword logic, evidence lanes, donor companies, and calibration questions. Then use the <Link href="/blog/boolean-search-benchmark/">five Boolean query archetypes</Link> and the <Link href="/tools/search-lane-expander/">Search Lane Expander</Link> to turn that strategy into distinct lanes.</p></section>
     <section id="faq"><h2>FAQ</h2>{faq.map(([q,a])=><div className="faq" key={q}><h3>{q}</h3><p>{a}</p></div>)}</section>
     <div className="cta"><strong>Your next intake:</strong> <Link href="/tools/jd-search-strategy/">turn the role into a search plan</Link>.</div>
    </article>
   </div>
  </main>
 </>
}
