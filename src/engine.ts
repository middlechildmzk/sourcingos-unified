import { govConCompanies, modeKeywordSeeds, titleSeeds } from './data';
import type { AISettings, CandidateSynthesis, ClearanceSignal, ContactSignal, EvidenceItem, EvidenceMatrixRow, FeedbackEvent, IdentityMergeSuggestion, PoolEstimate, ProjectMemory, RepoHighlight, RoleAnalysis, SearchLane, SourceName, SourceProfile, SourcedCandidate, SourceRun, SourcingMode } from './types';

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const now = () => new Date().toISOString();
const cap = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase());
const uniq = <T,>(values: T[]) => [...new Set(values.filter(Boolean))];
const lower = (s: string) => (s || '').toLowerCase();
const quote = (s: string) => /\s|\//.test(s) ? `"${s}"` : s;
const orGroup = (items: string[]) => `(${uniq(items).slice(0, 10).map(quote).join(' OR ')})`;

const clearancePatterns: Array<{ level: ClearanceSignal['level']; regex: RegExp; confidence: number }> = [
  { level:'ts_sci', regex:/\bTS\/?SCI\b|Top Secret\s*\/\s*SCI|SCI eligible/i, confidence:0.68 },
  { level:'polygraph', regex:/\bpoly(graph)?\b|CI poly|full scope poly/i, confidence:0.62 },
  { level:'top_secret', regex:/\bTop Secret\b|\bTS clearance\b/i, confidence:0.64 },
  { level:'secret', regex:/\bSecret clearance\b|\bactive secret\b|\bDoD Secret\b/i, confidence:0.6 },
  { level:'public_trust', regex:/\bpublic trust\b|moderate risk public trust/i, confidence:0.58 },
  { level:'unknown', regex:/\bclearance\b|\bcleared\b/i, confidence:0.45 }
];
function snippet(text: string, index: number) { return text.slice(Math.max(0, index - 70), Math.min(text.length, index + 150)).trim(); }
export function parseClearanceSignals(text: string): ClearanceSignal[] {
  return clearancePatterns.flatMap(p => { const m = text.match(p.regex); return m ? [{ level:p.level, phrase:m[0], confidence:p.confidence, caution:'Clearance signal: public breadcrumb only. Manual verification required.', sourceText: snippet(text, m.index || 0) }] : []; });
}
function includesAny(text: string, values: string[]) { const t = lower(text); return values.filter(v => t.includes(lower(v))); }
function inferRoleTitle(jd: string, mode: SourcingMode) { const direct = titleSeeds[mode].find(t => lower(jd).includes(lower(t))); const line = jd.split(/\n|\./).find(l => /(engineer|analyst|developer|architect|isso|issm|scientist|administrator|designer)/i.test(l)); return direct || line?.slice(0, 76).trim() || titleSeeds[mode][0]; }
function inferLocations(jd: string) { return uniq(jd.match(/(remote|hybrid|dc metro|washington dc|reston|chantilly|herndon|arlington|virginia|maryland|minneapolis|waconia|colorado springs|san antonio|jbsa|lackland|tampa|huntsville|dallas|austin)/gi) || []).slice(0, 8); }
function frontendRole(text: string) { return /front[-\s]?end|frontend|ui\/ux|wireframe|mockup|javascript|react|angular|ember/i.test(text); }
function clearedRole(text: string, mode: SourcingMode, signals: ClearanceSignal[]) { return signals.length > 0 || /dod|classified|govcon|federal|jbsa|lackland|clearance|ts\/sci|secret/i.test(text + mode); }
function expandTitles(roleTitle: string, mode: SourcingMode, text: string) {
  const base = [roleTitle, ...titleSeeds[mode]];
  if (frontendRole(text)) base.unshift('Front End Developer','Frontend Engineer','UI Engineer','JavaScript Developer','Full Stack Engineer','Application Developer','Web Application Developer');
  if (/devsecops|containers|jenkins|gitlab|cloud/i.test(text)) base.push('DevSecOps Engineer','Software Engineer','Cloud Application Developer');
  return uniq(base).slice(0, 9);
}
function estimatePool(jd: string, mode: SourcingMode, mustHaves: string[], titles: string[], clearanceSignals: ClearanceSignal[], locations: string[]): PoolEstimate {
  let difficulty = 40; const rationale: string[] = [];
  if (clearanceSignals.length) { difficulty += 20; rationale.push('Clearance language narrows reachable market and requires manual verification.'); }
  if (/onsite|5 days|five days|classified|scif/i.test(jd)) { difficulty += 12; rationale.push('Onsite/classified work sharply reduces candidate supply.'); }
  if (/san antonio|jbsa|lackland/i.test(jd)) { difficulty += 10; rationale.push('San Antonio/JBSA/Lackland location is a real funnel constraint for cleared software talent.'); }
  if (/govcloud|fedramp|nist|rmf|dod|ic|public trust/i.test(jd)) { difficulty += 10; rationale.push('Federal/GovCon domain signals reduce the pool but improve precision.'); }
  if (mustHaves.length > 8) { difficulty += 8; rationale.push('Many must-haves increase false negatives and reduce candidate supply.'); }
  if (titles.length >= 5) { difficulty -= 6; rationale.push('Multiple title paths improve recall.'); }
  if (/remote/i.test(jd)) { difficulty -= 8; rationale.push('Remote flexibility increases accessible candidate pool.'); }
  if (mode === 'AI / ML') { difficulty += 5; rationale.push('AI/ML searches benefit from Hugging Face, papers, packages, and GitHub evidence combined.'); }
  difficulty = Math.max(18, Math.min(95, difficulty));
  const difficultyLabel = difficulty > 82 ? 'Very Hard' : difficulty > 62 ? 'Hard' : difficulty > 42 ? 'Moderate' : 'Easy';
  const locationHint = locations.length ? locations.join(', ') : 'target geography';
  return {
    estimatedPool: difficulty > 80 ? 'Narrow: 25–90 likely reachable profiles before expansion' : difficulty > 60 ? 'Constrained: 90–250 likely reachable profiles with adjacent lanes' : difficulty > 40 ? 'Moderate: 250–700 likely reachable profiles across public evidence sources' : 'Broad: 700+ likely reachable profiles before filtering',
    githubRepoSignal:'GitHub signal is strongest for repo owners, languages, topics, README keywords, and recent activity. It is not a clearance or job-interest source.',
    stackOverflowSignal:'Stack Overflow signal is strongest for repeated tag activity and visible technical communication depth. It is not a current-employment source.',
    difficulty,
    difficultyLabel,
    rationale: rationale.length ? rationale : ['Balanced market with enough technical evidence to start public API sourcing.'],
    expansionSuggestions:[
      `Add adjacent titles: ${titles.slice(1, 6).join(', ')}`,
      `Run separate location searches for ${locationHint}, then broaden to donor companies and nearby cleared markets.`,
      `Broaden keywords: ${modeKeywordSeeds[mode].slice(0, 7).join(', ')}`,
      'Use profile linking before adding too many sources to avoid duplicate/noisy profiles.',
      'If pool is thin, loosen exact title before loosening critical skill evidence.'
    ],
    riskFlags:['GitHub and Stack Overflow are evidence sources, not job-intent sources.','Public clearance mentions are breadcrumbs only, never clearance verification.','Manual recruiter review is required before adding anyone to pipeline.']
  };
}
function buildLanes(mode: SourcingMode, titles: string[], adjacentTitles: string[], keywords: string[], companies: string[], locations: string[], clearanceSignals: ClearanceSignal[], jd: string): SearchLane[] {
  const titleBlock = orGroup(titles.slice(0,5));
  const adjacentBlock = orGroup(adjacentTitles.slice(0,5));
  const skillBlock = orGroup(keywords.slice(0,8));
  const locBlock = locations.length ? orGroup([...locations, 'San Antonio TX', 'JBSA', 'Lackland'].slice(0, 6)) : '(remote OR hybrid OR onsite)';
  const clearanceBlock = clearanceSignals.length || clearedRole(jd, mode, clearanceSignals) ? orGroup(['TS/SCI','Top Secret','SCI','Secret','DoD','classified','clearance']) : '';
  const frontendStack = orGroup(['JavaScript','React','Angular','Ember','Node','Jenkins','GitLab','DevSecOps','microservices','containers']);
  const companyBlock = orGroup(companies.slice(0,8));
  return [
    { id:'search-intel-tight-linkedin', name:'Tight LinkedIn X-Ray', bestSource:'LinkedIn X-Ray via Google', goal:'Find public profile pages with title, clearance breadcrumb, location, and stack overlap.', query:`site:linkedin.com/in ${titleBlock} ${clearanceBlock} ${locBlock} ${frontendRole(jd) ? frontendStack : skillBlock} -jobs -job -recruiter`, expectedYield:'Low, highest precision', noiseLevel:'low', falsePositiveWarnings:['Public profile snippets are incomplete','Clearance text is only a breadcrumb','Profiles may be stale'] },
    { id:'search-intel-broad-linkedin', name:'Broad LinkedIn X-Ray', bestSource:'LinkedIn X-Ray via Google', goal:'Expand beyond exact front-end title into full-stack, UI, app, and web developers.', query:`site:linkedin.com/in ${orGroup([...titles, ...adjacentTitles].slice(0,8))} ${locBlock} ${orGroup(keywords.slice(0,6))} -jobs -job -recruiter`, expectedYield:'Medium, balanced precision', noiseLevel:'medium', falsePositiveWarnings:['Wrong seniority','General web developers without classified/federal domain','Tool mentions without hands-on evidence'] },
    { id:'clearance-signal', name:'Clearance Signal Lane', bestSource:'Google + manual ClearanceJobs copy', goal:'Find clearance breadcrumbs, cleared community terms, and GovCon context without claiming verification.', query:`${titleBlock} ${clearanceBlock || orGroup(['clearance','DoD','classified'])} ${locBlock} ${orGroup(['JBSA','Lackland','AFCEA Alamo','GovCon'])}`, expectedYield:'Low but high-value', noiseLevel:'high', falsePositiveWarnings:['Never verify clearance from public text','Old roles may mention past clearance','Company/job pages can pollute results'] },
    { id:'github-repos', name:'GitHub Repo Evidence Lane', bestSource:'GitHub repo search', goal:'Find public JavaScript/front-end repo evidence and repo owners for recruiter review.', query:frontendRole(jd) ? `language:JavaScript ${keywords.filter(k => /react|angular|ember|node|javascript|frontend|ui|microservices|containers|devsecops|gitlab|jenkins/i.test(k)).slice(0,8).join(' ')}` : keywords.slice(0,8).join(' '), expectedYield:'Medium; technical evidence only', noiseLevel:'medium', falsePositiveWarnings:['Org accounts','Tutorial repos','No location/clearance signal'] },
    { id:'github-users', name:'GitHub User/Profile X-Ray', bestSource:'Google X-Ray GitHub users', goal:'Find profile/bio pages that combine stack terms with San Antonio or GovCon breadcrumbs.', query:`site:github.com ${frontendRole(jd) ? frontendStack : skillBlock} ${locations.length ? locBlock : ''} -jobs -course -tutorial`, expectedYield:'Low to medium', noiseLevel:'high', falsePositiveWarnings:['GitHub profile pages rarely show complete work history','Location can be missing','No clearance verification'] },
    { id:'company-community', name:'GovCon Company + Community Lane', bestSource:'Google / donor-company search', goal:'Map donor companies, local cleared communities, and JBSA/Lackland adjacent software teams.', query:`${companyBlock} ${titleBlock} ${locBlock} ${orGroup(['JBSA','Lackland','AFCEA Alamo','San Antonio'])}`, expectedYield: clearedRole(jd, mode, clearanceSignals) ? 'Constrained but high relevance' : 'Useful when company domain matters', noiseLevel:'high', falsePositiveWarnings:['Company pages and job postings can dominate','Employment currentness requires manual review'] },
    { id:'clearancejobs-copy', name:'ClearanceJobs Copy String', bestSource:'ClearanceJobs manual authorized workflow', goal:'Copy into authorized ClearanceJobs workflow. Do not scrape.', query:`${titles.slice(0,5).join(' OR ')} | ${keywords.slice(0,10).join(', ')} | ${locations.join(', ') || 'San Antonio'} | ${clearanceSignals.length ? clearanceSignals.map(c=>c.phrase).join(', ') : 'TS/SCI OR Top Secret OR SCI'}`, expectedYield:'Manual gated source', noiseLevel:'medium', falsePositiveWarnings:['Use only inside authorized account','Clearance and availability still require recruiter verification'] },
    { id:'job-board-intel', name:'Indeed / Job Board Intelligence', bestSource:'Manual market intelligence', goal:'Understand title language, donor companies, comp/context, and competing reqs.', query:`${titleBlock} ${locBlock} ${frontendRole(jd) ? frontendStack : skillBlock}`, expectedYield:'Market intelligence, not candidate extraction', noiseLevel:'medium', falsePositiveWarnings:['Job posts are not candidate profiles','Use for calibration, not scraping'] }
  ];
}
export function analyzeRole(jd: string, mode: SourcingMode): RoleAnalysis {
  const text = jd.trim() || 'Technical role'; const roleTitle = inferRoleTitle(text, mode); const seed = modeKeywordSeeds[mode];
  const words = uniq((lower(text).match(/[a-z][a-z0-9+#.\/-]{2,}/g) || []).filter(w => !['with','and','the','for','role','must','have','supporting','experience','preferred','location','candidate','years','recent','required'].includes(w)));
  const keywords = uniq([...includesAny(text, seed), ...seed.slice(0, 8), ...words.filter(w => /kubernetes|terraform|python|aws|azure|security|linux|react|angular|ember|node|javascript|typescript|java|jira|jenkins|gitlab|microservices|containers|container|cloud|ui|ux|wireframes|mockups|testing|docker|fedramp|nist|rmf|devsecops|ci\/cd|huggingface|mlops|fhir|hl7/i.test(w))]).slice(0, 24);
  const targetTitles = expandTitles(roleTitle, mode, text); const adjacentTitles = uniq([...titleSeeds[mode].slice(1), 'Platform Engineer', 'Solutions Architect', 'Software Developer', 'Application Engineer']).slice(0, 9);
  const clearanceSignals = parseClearanceSignals(text); const locations = inferLocations(text); const companies = clearedRole(text, mode, clearanceSignals) ? govConCompanies.slice(0, 12) : ['Amazon','Microsoft','Google','Databricks','Snowflake','Red Hat','HashiCorp'];
  const mustHaves = keywords.slice(0, 10).map(cap); const niceToHaves = keywords.slice(10, 18).map(cap); const poolEstimate = estimatePool(text, mode, mustHaves, targetTitles, clearanceSignals, locations);
  const titleBlock = orGroup(targetTitles.slice(0,5)); const keywordBlock = orGroup(keywords.slice(0,8)); const locBlock = locations.length ? orGroup(locations) : '(remote OR hybrid OR onsite)';
  const clearanceBlock = clearanceSignals.length || clearedRole(text, mode, clearanceSignals) ? orGroup(['TS/SCI','Top Secret','SCI','Secret','DoD','classified','clearance']) : '';
  const frontendBlock = frontendRole(text) ? orGroup(['JavaScript','React','Angular','Ember','Node','Jenkins','GitLab','DevSecOps','microservices','containers','UI/UX']) : keywordBlock;
  return {
    id: uid('role'),
    roleTitle,
    mode,
    summary:`${roleTitle} search in ${mode}. Search Intelligence should build searches and launch/copy source strings, while candidate cards must come only from real public or authorized sources.`,
    parsedFields:[{label:'Role title',value:roleTitle,confidence:.82},{label:'Mode',value:mode,confidence:.9},{label:'Core keywords',value:keywords.slice(0,10).join(', '),confidence:.8},{label:'Locations',value:locations.join(', ') || 'Remote / unspecified',confidence:.68},{label:'Funnel constraint',value: clearanceSignals.length || /onsite|san antonio|jbsa|lackland/i.test(text) ? `${clearanceSignals.length ? clearanceSignals.map(c=>c.phrase).join(', ') : 'No clearance parsed'} + ${locations.join(', ') || 'location/onsite constraint'}` : 'No major hard gate detected',confidence:.78}],
    mustHaves,
    niceToHaves,
    disqualifiers:['Clearance claims not manually confirmed','Name-only identity merges','LLM-generated candidate names','Public evidence with no role relevance'],
    targetTitles,
    adjacentTitles,
    keywords,
    filters: uniq([...includesAny(text, ['remote','hybrid','onsite','secret','top secret','ts/sci','public trust','dod','federal','govcloud','fedramp','nist','healthcare','hipaa','san antonio','jbsa','lackland']), ...keywords.slice(0, 5)]),
    targetCompanies: companies,
    locations,
    clearanceSignals,
    poolEstimate,
    booleanStrings:[`${titleBlock} AND ${keywordBlock}`, `${titleBlock} AND ${frontendBlock} AND ${locBlock}`, clearanceBlock ? `${titleBlock} AND ${frontendBlock} AND ${clearanceBlock} AND ${locBlock}` : `${titleBlock} AND ${frontendBlock}`],
    xrayStrings:[
      `site:linkedin.com/in ${titleBlock} ${frontendBlock} ${clearanceBlock} ${locBlock} -jobs -job -recruiter`,
      `site:linkedin.com/in ${orGroup([...targetTitles, ...adjacentTitles].slice(0,8))} ${frontendBlock} ${locBlock} -jobs -job -recruiter`,
      `site:github.com ${frontendRole(text) ? orGroup(['JavaScript','React','Angular','Ember','Node','GitLab','Jenkins','DevSecOps']) : orGroup(keywords.slice(0,7))} ${locations.length ? locBlock : ''} -jobs -course -tutorial`,
      `site:stackoverflow.com/users ${orGroup(keywords.slice(0,6))}`,
      `${orGroup(companies.slice(0,8))} ${titleBlock} ${locBlock} ${orGroup(['JBSA','Lackland','AFCEA Alamo','GovCon'])}`
    ],
    searchLanes: buildLanes(mode, targetTitles, adjacentTitles, keywords, companies, locations, clearanceSignals, text),
    sourceQueries:{ githubRepoQuery: keywords.slice(0,8).join(' '), stackOverflowTags: keywords.filter(k => /^[a-z0-9+#.-]+$/i.test(k)).slice(0,5), openAlexQuery: `${roleTitle} ${keywords.slice(0,3).join(' ')}`, packageQuery: keywords.slice(0,4).join(' ') }
  };
}

async function safeJson<T>(url: string, timeoutMs = 9000): Promise<T> { const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs); try { const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } }); if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return await r.json(); } finally { clearTimeout(t); } }
const safeUrl = (s: string) => s.startsWith('http') ? s : `https://${s}`;
export function extractGitHubUsername(input: string) { const m = input.trim().match(/github\.com\/([^/?#]+)/i); return (m?.[1] || input.trim().replace(/^@/, '')).split('/')[0]; }
export function extractStackOverflowUserId(input: string) { const m = input.trim().match(/stackoverflow\.com\/users\/(\d+)/i); return m?.[1] || input.trim().match(/^\d+$/)?.[0] || ''; }

function contact(candidateId: string, type: ContactSignal['type'], value: string, source: SourceName, confidence: 'low'|'medium'|'high' = 'medium'): ContactSignal { return { id: uid('contact'), candidateId, type, value, source, confidence, verificationStatus:'not_verified', riskNote:'Public contact signal. Not verified. Recruiter must confirm before outreach.' }; }
function sourceProfile(candidateId: string, source: SourceName, url: string, fields: Partial<SourceProfile>): SourceProfile { return { id: uid('profile'), candidateId, source, url, fetchedAt: now(), confidence:'medium', status:'needs_review', rawSummary:'Public source profile linked for recruiter review.', ...fields }; }
function evidence(label: string, detail: string, source: SourceName, url?: string, confidence = .72): EvidenceItem { return { id: uid('ev'), label, detail, source, url, confidence, createdAt: now() }; }
function matrix(skill: string, evidenceText: string, source: SourceName, confidence: 'low'|'medium'|'high' = 'medium', url?: string): EvidenceMatrixRow { return { skill, evidence: evidenceText, source, confidence, recency:'Public source recency varies; verify manually.', url }; }

export async function fetchGitHubProfile(input: string, candidateId: string) {
  const username = extractGitHubUsername(input); if (!username) throw new Error('Missing GitHub username.');
  const user: any = await safeJson(`https://api.github.com/users/${encodeURIComponent(username)}`);
  let repos: any[] = [];
  try { repos = await safeJson(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=12&sort=updated`); } catch { repos = []; }
  const profile = sourceProfile(candidateId, 'github', user.html_url, { username:user.login, displayName:user.name || user.login, headline:user.bio || 'GitHub public profile', location:user.location || '', publicEmail:user.email || '', website:user.blog || '', avatarUrl:user.avatar_url, confidence: repos.length ? 'high' : 'medium', rawSummary:`${user.name || user.login} has ${user.public_repos || 0} public repos. Bio: ${user.bio || 'none'}.` });
  const contacts = [contact(candidateId,'github',user.html_url,'github','high'), user.email ? contact(candidateId,'email',user.email,'github','medium') : null, user.blog ? contact(candidateId,'website',safeUrl(user.blog),'github','medium') : null].filter(Boolean) as ContactSignal[];
  const repoHighlights: RepoHighlight[] = repos.map(r => ({ name:r.name, url:r.html_url, description:r.description || '', language:r.language || 'Unknown', stars:r.stargazers_count || 0, forks:r.forks_count || 0, topics:r.topics || [], updatedAt:r.updated_at || '' }));
  const ev = [evidence('GitHub public profile', profile.rawSummary, 'github', user.html_url, .82), ...repoHighlights.slice(0, 5).map(r => evidence(`Repo: ${r.name}`, `${r.language} repo with ${r.stars} stars. ${r.description}`, 'github', r.url, .76))];
  const rows = repoHighlights.slice(0, 8).flatMap(r => [r.language, ...r.topics].filter(Boolean).slice(0, 4).map(s => matrix(String(s), `GitHub repo ${r.name}: ${r.description || 'public repository evidence'}`, 'github', r.stars > 10 ? 'high' : 'medium', r.url)));
  return { profile, contacts, evidence: ev, repoHighlights, evidenceMatrix: rows };
}
export async function fetchStackOverflowProfile(input: string, candidateId: string) {
  const userId = extractStackOverflowUserId(input); if (!userId) throw new Error('Missing Stack Overflow user ID.');
  const data: any = await safeJson(`https://api.stackexchange.com/2.3/users/${encodeURIComponent(userId)}?site=stackoverflow&filter=default`);
  const user = data.items?.[0]; if (!user) throw new Error('No Stack Overflow user found.');
  let tags: any[] = []; try { const tagData: any = await safeJson(`https://api.stackexchange.com/2.3/users/${userId}/tags?site=stackoverflow&pagesize=12&order=desc&sort=popular`); tags = tagData.items || []; } catch { tags = []; }
  const url = user.link; const topTags = tags.map(t => ({ name:t.name, count:t.count || 0 }));
  const profile = sourceProfile(candidateId, 'stackoverflow', url, { username:String(user.user_id), displayName:user.display_name, headline:`${user.reputation || 0} reputation · ${topTags.slice(0,5).map(t=>t.name).join(', ')}`, location:user.location || '', avatarUrl:user.profile_image, confidence: topTags.length ? 'high' : 'medium', rawSummary:`Stack Overflow profile with ${user.reputation || 0} reputation and top tags ${topTags.slice(0,5).map(t=>t.name).join(', ') || 'not available'}.` });
  const contacts = [contact(candidateId,'stackoverflow',url,'stackoverflow','high'), user.website_url ? contact(candidateId,'website',safeUrl(user.website_url),'stackoverflow','medium') : null].filter(Boolean) as ContactSignal[];
  const ev = [evidence('Stack Overflow public profile', profile.rawSummary, 'stackoverflow', url, .78), ...topTags.slice(0, 8).map(t => evidence(`SO tag: ${t.name}`, `${t.count} visible tag activities/questions/answers signal.`, 'stackoverflow', url, .7))];
  const rows = topTags.slice(0, 10).map(t => matrix(t.name, `${t.count} Stack Overflow tag activities`, 'stackoverflow', t.count > 20 ? 'high' : 'medium', url));
  return { profile, contacts, evidence: ev, stackOverflow: { reputation:user.reputation || 0, badges:`${user.badge_counts?.gold || 0} gold / ${user.badge_counts?.silver || 0} silver / ${user.badge_counts?.bronze || 0} bronze`, topTags }, evidenceMatrix: rows };
}
export async function fetchOpenAlexProfile(query: string, candidateId: string) {
  if (!query.trim()) throw new Error('Missing OpenAlex author query.');
  const data: any = await safeJson(`https://api.openalex.org/authors?search=${encodeURIComponent(query)}&per-page=3`);
  const a = data.results?.[0]; if (!a) throw new Error('No OpenAlex author found.');
  const url = a.id || `https://openalex.org/search/authors?q=${encodeURIComponent(query)}`;
  const profile = sourceProfile(candidateId, 'openalex', url, { username:a.orcid || a.id, displayName:a.display_name, headline:`${a.works_count || 0} works · ${a.cited_by_count || 0} citations`, location:a.last_known_institution?.display_name || '', website:a.orcid || '', confidence:'medium', rawSummary:`OpenAlex author ${a.display_name} has ${a.works_count || 0} works and ${a.cited_by_count || 0} citations. Top concepts: ${(a.x_concepts || []).slice(0,5).map((c:any)=>c.display_name).join(', ')}` });
  const contacts = [contact(candidateId,'openalex',url,'openalex','medium'), a.orcid ? contact(candidateId,'orcid',a.orcid,'openalex','medium') : null].filter(Boolean) as ContactSignal[];
  const rows = (a.x_concepts || []).slice(0, 8).map((c:any) => matrix(c.display_name, `OpenAlex concept score ${Math.round((c.score || 0) * 100)} from public author metadata`, 'openalex', 'medium', url));
  return { profile, contacts, evidence:[evidence('OpenAlex author profile', profile.rawSummary, 'openalex', url, .68)], evidenceMatrix: rows };
}

async function fetchHuggingFaceUser(username: string, candidateId: string) { const u = username.replace(/https?:\/\/huggingface\.co\//,'').trim(); const data:any = await safeJson(`https://huggingface.co/api/users/${encodeURIComponent(u)}`); const url = `https://huggingface.co/${u}`; return { profile: sourceProfile(candidateId,'huggingface',url,{ username:u, displayName:data.fullname || u, headline:`Hugging Face profile · ${data.numModels || 0} models`, rawSummary:`Public Hugging Face profile with model/dataset/space signals where available.`, confidence:'medium' }), contacts:[contact(candidateId,'portfolio',url,'huggingface','medium')], evidence:[evidence('Hugging Face profile', `Public AI/ML profile for ${u}.`, 'huggingface', url, .66)], evidenceMatrix:[matrix('Hugging Face', 'Public model/dataset/space profile linked', 'huggingface', 'medium', url)] }; }
async function fetchNpmPackage(pkg: string, candidateId: string) { const name = pkg.trim().replace(/^npm:/,''); const data:any = await safeJson(`https://registry.npmjs.org/${encodeURIComponent(name)}`); const url = `https://www.npmjs.com/package/${name}`; const maintainers = (data.maintainers || []).map((m:any)=>m.name).join(', '); return { profile: sourceProfile(candidateId,'npm',url,{ username:name, displayName:name, headline:`npm package · latest ${data['dist-tags']?.latest || ''}`, rawSummary:`npm package ${name}. Maintainers: ${maintainers || 'not listed'}.`, confidence:'medium' }), contacts:[contact(candidateId,'package',url,'npm','medium')], evidence:[evidence('npm package evidence', `${name}: ${data.description || 'public package metadata'}`, 'npm', url, .64)], evidenceMatrix:[matrix('JavaScript package', `${name}: ${data.description || 'public package metadata'}`, 'npm', 'medium', url)] }; }
async function fetchPyPiPackage(pkg: string, candidateId: string) { const name = pkg.trim().replace(/^pypi:/,''); const data:any = await safeJson(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`); const url = data.info?.package_url || `https://pypi.org/project/${name}/`; return { profile: sourceProfile(candidateId,'pypi',url,{ username:name, displayName:name, headline:`PyPI package · ${data.info?.version || ''}`, rawSummary:`PyPI package ${name}. ${data.info?.summary || ''}`, confidence:'medium' }), contacts:[contact(candidateId,'package',url,'pypi','medium')], evidence:[evidence('PyPI package evidence', `${name}: ${data.info?.summary || 'public package metadata'}`, 'pypi', url, .64)], evidenceMatrix:[matrix('Python package', `${name}: ${data.info?.summary || 'public package metadata'}`, 'pypi', 'medium', url)] }; }
async function fetchOrcid(orcid: string, candidateId: string) { const id = orcid.replace('https://orcid.org/','').trim(); const data:any = await safeJson(`https://pub.orcid.org/v3.0/${encodeURIComponent(id)}/record`); const url = `https://orcid.org/${id}`; const name = [data.person?.name?.['given-names']?.value, data.person?.name?.['family-name']?.value].filter(Boolean).join(' ') || id; return { profile: sourceProfile(candidateId,'orcid',url,{ username:id, displayName:name, headline:'ORCID public researcher identity', rawSummary:`ORCID public record for ${name}.`, confidence:'medium' }), contacts:[contact(candidateId,'orcid',url,'orcid','medium')], evidence:[evidence('ORCID identity evidence', `ORCID public record for ${name}.`, 'orcid', url, .62)], evidenceMatrix:[matrix('Research identity', `ORCID public researcher identity`, 'orcid', 'medium', url)] }; }
export type ProfileLinkInput = { githubUrl?: string; stackOverflowUrl?: string; openAlexQuery?: string; huggingFaceUser?: string; npmPackage?: string; pypiPackage?: string; orcid?: string; manualLinkedInUrl?: string; personalWebsite?: string; };
function mergeConfidence(candidate: SourcedCandidate, profiles: SourceProfile[], contacts: ContactSignal[], matrixRows: EvidenceMatrixRow[]): IdentityMergeSuggestion {
  const reasons: string[] = []; const conflicts: string[] = []; let score = .22;
  const names = profiles.map(p => lower(p.displayName || '')).filter(Boolean); if (names.some(n => n.includes(lower(candidate.name)) || lower(candidate.name).includes(n))) { score += .2; reasons.push('Display name overlaps candidate/source profile name.'); }
  const websites = contacts.filter(c => c.type === 'website').map(c => lower(c.value)); if (websites.length && new Set(websites).size < websites.length) { score += .25; reasons.push('Same personal website appears across sources.'); }
  const skillOverlap = candidate.matchedSkills.filter(s => matrixRows.some(r => lower(r.skill).includes(lower(s)) || lower(r.evidence).includes(lower(s)))); if (skillOverlap.length >= 2) { score += .2; reasons.push(`Overlapping skill evidence: ${skillOverlap.slice(0,4).join(', ')}.`); }
  if (profiles.length >= 3) { score += .12; reasons.push('Three or more public source profiles linked to the same candidate dossier.'); }
  const locs = profiles.map(p => lower(p.location || '')).filter(Boolean); if (new Set(locs).size > 1) conflicts.push(`Location differs across sources: ${uniq(locs).join(', ')}`);
  score = Math.min(.95, score); const confidenceLabel = score > .74 ? 'high' : score > .48 ? 'medium' : 'low';
  return { candidateId:candidate.id, confidence:score, confidenceLabel, reasons: reasons.length ? reasons : ['Evidence attached, but identity confidence remains low until recruiter confirms.'], conflicts, recommendation: confidenceLabel === 'high' ? 'confirm_link' : confidenceLabel === 'medium' ? 'review_side_by_side' : 'keep_separate', status:'suggested' };
}
function recalcCandidate(candidate: SourcedCandidate): SourcedCandidate { const contactabilityScore = Math.min(100, 20 + candidate.contactSignals.length * 14 + (candidate.contactSignals.some(c=>c.type==='email') ? 20 : 0)); const profileCompleteness = Math.min(100, 35 + candidate.sourceProfiles.length * 12 + candidate.evidenceMatrix.length * 2); const technicalDepthScore = Math.min(100, candidate.technicalDepthScore + Math.round(candidate.evidenceMatrix.length / 3)); const fitScore = Math.min(99, Math.round(candidate.fitScore * .75 + technicalDepthScore * .18 + profileCompleteness * .07)); return { ...candidate, contactabilityScore, profileCompleteness, technicalDepthScore, fitScore }; }
export async function linkPublicSourceProfiles(candidate: SourcedCandidate, links: ProfileLinkInput): Promise<SourcedCandidate> {
  const pieces: Array<{ profile?: SourceProfile; contacts?: ContactSignal[]; evidence?: EvidenceItem[]; evidenceMatrix?: EvidenceMatrixRow[]; repoHighlights?: RepoHighlight[]; stackOverflow?: SourcedCandidate['stackOverflow'] }> = [];
  const errors: string[] = [];
  for (const [key, fn] of [
    ['GitHub', () => links.githubUrl ? fetchGitHubProfile(links.githubUrl!, candidate.id) : null],
    ['Stack Overflow', () => links.stackOverflowUrl ? fetchStackOverflowProfile(links.stackOverflowUrl!, candidate.id) : null],
    ['OpenAlex', () => links.openAlexQuery ? fetchOpenAlexProfile(links.openAlexQuery!, candidate.id) : null],
    ['Hugging Face', () => links.huggingFaceUser ? fetchHuggingFaceUser(links.huggingFaceUser!, candidate.id) : null],
    ['npm', () => links.npmPackage ? fetchNpmPackage(links.npmPackage!, candidate.id) : null],
    ['PyPI', () => links.pypiPackage ? fetchPyPiPackage(links.pypiPackage!, candidate.id) : null],
    ['ORCID', () => links.orcid ? fetchOrcid(links.orcid!, candidate.id) : null]
  ] as Array<[string, () => Promise<any> | null]>) {
    try { const result = await fn(); if (result) pieces.push(result); } catch (e) { errors.push(`${key}: ${e instanceof Error ? e.message : 'failed'}`); }
  }
  const manualContacts: ContactSignal[] = [links.manualLinkedInUrl ? contact(candidate.id,'linkedin_manual',links.manualLinkedInUrl,'manual','medium') : null, links.personalWebsite ? contact(candidate.id,'website',safeUrl(links.personalWebsite),'manual','medium') : null].filter(Boolean) as ContactSignal[];
  const sourceProfiles = [...candidate.sourceProfiles, ...pieces.map(p=>p.profile).filter(Boolean) as SourceProfile[]];
  const contactSignals = [...candidate.contactSignals, ...manualContacts, ...pieces.flatMap(p=>p.contacts || [])];
  const evidenceItems = [...candidate.evidence, ...pieces.flatMap(p=>p.evidence || []), ...errors.map(err => evidence('Connector warning', err, 'manual', undefined, .45))];
  const evidenceMatrix = [...candidate.evidenceMatrix, ...pieces.flatMap(p=>p.evidenceMatrix || [])];
  const repoHighlights = [...candidate.repoHighlights, ...pieces.flatMap(p=>p.repoHighlights || [])];
  const updated: SourcedCandidate = { ...candidate, sourceProfiles, contactSignals, evidence: evidenceItems, evidenceMatrix, repoHighlights, stackOverflow: pieces.find(p=>p.stackOverflow)?.stackOverflow || candidate.stackOverflow };
  const withSuggestion = { ...updated, identityMergeSuggestion: mergeConfidence(updated, sourceProfiles, contactSignals, evidenceMatrix) };
  return recalcCandidate(withSuggestion);
}

function baseCandidate(name: string, username: string, source: SourceName, role: RoleAnalysis, url: string, skills: string[], depth = 70): SourcedCandidate {
  const matched = uniq([...skills, ...role.keywords.filter(k => skills.some(s => lower(s).includes(lower(k)) || lower(k).includes(lower(s))))]).slice(0, 12);
  const id = uid('cand'); const ev = matched.slice(0, 5).map(s => evidence(`Evidence: ${s}`, `Public ${source} signal references ${s}.`, source, url, .65));
  return { id, name, username, source, profileUrl:url, headline:`${role.roleTitle} adjacent public evidence from ${source}`, company:'Unknown / public source', location:'Unknown', fitScore: Math.min(96, 48 + matched.length * 5), sourceConfidence:.66, technicalDepthScore:depth, contactabilityScore:35, profileCompleteness:45, matchedSkills:matched, missingSignals:['Current employment','Interest/availability','Location/remote openness','Clearance status if required'], evidence:ev, repoHighlights:[], guardrails:['Evidence-only profile. Manual review required.','No automated outreach.','Clearance signals, if any, are public breadcrumbs only.'], stage:'new', sourceProfiles:[sourceProfile(id, source, url, { username, displayName:name, headline:`Public ${source} profile`, rawSummary:`Initial ${source} source result for ${name}.`, confidence:'medium' })], contactSignals:[contact(id, source === 'github' ? 'github' : source === 'stackoverflow' ? 'stackoverflow' : 'other', url, source, 'medium')], evidenceMatrix:matched.slice(0, 8).map(s => matrix(s, `Initial source result matched ${s}`, source, 'medium', url)) };
}
export function demoSourceCandidates(role: RoleAnalysis) {
  const run: SourceRun = { id:uid('run'), status:'complete', startedAt:now(), completedAt:now(), roleId:role.id, sources:['manual_demo'], querySummary:'DEMO ONLY - not real sourcing output', notes:['Demo candidates are synthetic test records only. They are visually labeled and must never be used as real sourcing output.'], errors:[], resultCount:6 };
  const names = ['DEMO Alex Morgan','DEMO Jordan Lee','DEMO Taylor Chen','DEMO Sam Rivera','DEMO Casey Patel','DEMO Riley Brooks'];
  const candidates = names.map((n,i) => {
    const c = baseCandidate(n, `demo-${i + 1}`, 'manual_demo', role, `https://example.com/demo-candidate-${i + 1}`, role.keywords.slice(i, i+7), 45 + i*3);
    return { ...c, demoOnly:true, headline:`DEMO ONLY synthetic record for UI testing. Not a real candidate.`, sourceConfidence:.05, fitScore:35 + i, technicalDepthScore:35 + i, contactabilityScore:5, profileCompleteness:10, guardrails:['DEMO ONLY synthetic test record.','Do not present, contact, export, or treat as a real candidate.','Real candidate cards must come only from public or authorized source results.'], evidence:[evidence('Demo-only warning','Synthetic record created only to test the UI flow. Not public evidence.', 'manual_demo', undefined, .1), ...c.evidence] };
  });
  return { run, candidates };
}
export async function sourceCandidatesFromPublicApis(role: RoleAnalysis) {
  const startedAt = now(); const candidates: SourcedCandidate[] = []; const errors: string[] = [];
  try { const gh:any = await safeJson(`https://api.github.com/search/repositories?q=${encodeURIComponent(role.sourceQueries.githubRepoQuery)}&sort=updated&order=desc&per_page=8`); for (const repo of (gh.items || []).slice(0,6)) { const owner = repo.owner || {}; const c = baseCandidate(owner.login || repo.full_name, owner.login || repo.full_name, 'github', role, owner.html_url || repo.html_url, uniq([repo.language, ...(repo.topics || []), ...role.keywords.slice(0,4)]).filter(Boolean), Math.min(95, 55 + (repo.stargazers_count || 0) / 10)); c.avatarUrl = owner.avatar_url; c.repoHighlights = [{ name:repo.name, url:repo.html_url, description:repo.description || '', language:repo.language || 'Unknown', stars:repo.stargazers_count || 0, forks:repo.forks_count || 0, topics:repo.topics || [], updatedAt:repo.updated_at || '' }]; c.evidence.unshift(evidence(`Repo: ${repo.name}`, `${repo.description || 'Repository matched role query'} · ${repo.stargazers_count || 0} stars`, 'github', repo.html_url, .74)); candidates.push(recalcCandidate(c)); } } catch (e) { errors.push(`GitHub: ${e instanceof Error ? e.message : 'failed'}`); }
  try { const tags = role.sourceQueries.stackOverflowTags.slice(0,2).join(';') || 'javascript'; const so:any = await safeJson(`https://api.stackexchange.com/2.3/tags/${encodeURIComponent(tags)}/top-answerers/all_time?site=stackoverflow&pagesize=6`); for (const item of (so.items || []).slice(0,5)) { const u = item.user || {}; const c = baseCandidate(u.display_name || `SO ${u.user_id}`, String(u.user_id), 'stackoverflow', role, u.link, role.sourceQueries.stackOverflowTags.slice(0,8), 68); c.avatarUrl = u.profile_image; c.stackOverflow = { reputation:u.reputation || 0, badges:'public badges available on profile', topTags:role.sourceQueries.stackOverflowTags.map(t=>({name:t,count:item.post_count || 0})) }; c.evidence.unshift(evidence('Stack Overflow top answerer', `${u.display_name} appears in top answerer results for ${tags}.`, 'stackoverflow', u.link, .72)); candidates.push(recalcCandidate(c)); } } catch (e) { errors.push(`Stack Overflow: ${e instanceof Error ? e.message : 'failed'}`); }
  const zeroNotes = candidates.length ? [] : ['0 real public API candidates returned. SourcingOS did not load demo fallback. Use Search Intelligence lanes, loosen exact titles, broaden location/donor-company terms, or run authorized gated searches manually.'];
  const run: SourceRun = { id:uid('run'), status:candidates.length ? 'complete' : errors.length ? 'error' : 'complete', startedAt, completedAt:now(), roleId:role.id, sources:['github','stackoverflow'], querySummary:role.sourceQueries.githubRepoQuery, notes:['Public API source run complete. Candidate cards are only from real public API records.', ...zeroNotes], errors, resultCount:candidates.length };
  return { run, candidates:rankCandidates(candidates) };
}
export function rankCandidates(candidates: SourcedCandidate[]) { return [...candidates].sort((a,b) => (b.fitScore + b.technicalDepthScore + b.profileCompleteness) - (a.fitScore + a.technicalDepthScore + a.profileCompleteness)); }
export function generateCandidateSynthesis(candidate: SourcedCandidate, role?: RoleAnalysis, settings?: AISettings): CandidateSynthesis {
  if (candidate.demoOnly) return { facts:['This is a demo-only synthetic test record.'], inferences:['Do not use this as a real candidate.'], conflicts:[], hmPitch:'Demo-only record. No hiring-manager pitch should be generated.', outreachAngle:'Do not contact demo records.', verifyNext:['Run real public API sourcing or manually link authorized profiles.'], generatedAt:now(), mode:'local_rule_based' };
  const skills = candidate.evidenceMatrix.map(r=>r.skill).slice(0,8); const facts = [`${candidate.sourceProfiles.length} linked source profile(s).`, `${candidate.contactSignals.length} public/manual contact signal(s).`, `${candidate.evidence.length} evidence item(s) attached.`, ...candidate.repoHighlights.slice(0,3).map(r => `GitHub repo ${r.name}: ${r.language}, ${r.stars} stars.`)];
  const inferences = [`Likely strongest evidence areas: ${uniq([...candidate.matchedSkills, ...skills]).slice(0,6).join(', ') || 'needs more evidence'}.`, `Profile completeness is ${candidate.profileCompleteness}/100 and contactability is ${candidate.contactabilityScore}/100.`, role ? `For ${role.roleTitle}, review must-have coverage against ${role.mustHaves.slice(0,5).join(', ')}.` : 'Run against an active role for more precise fit synthesis.'];
  return { facts, inferences, conflicts: candidate.identityMergeSuggestion?.conflicts || [], hmPitch:`${candidate.name} shows public technical evidence around ${candidate.matchedSkills.slice(0,5).join(', ')}. Fit score ${candidate.fitScore}/100; verify current role, interest, and any clearance requirement before presenting.`, outreachAngle:`Mention a specific public artifact or tag from ${candidate.sourceProfiles[0]?.source || candidate.source}, then connect it to the role problem. Keep as draft-first only.`, verifyNext:['Current employment and availability','Location/remote expectations','Depth with required stack','Work authorization / program eligibility where applicable','Clearance status only through approved process'], generatedAt:now(), mode: settings?.provider === 'local_only' ? 'local_rule_based' : 'llm_prompt_ready' };
}
export function buildSynthesisPrompt(candidate: SourcedCandidate, role?: RoleAnalysis) { return `You are enriching a SourcingOS candidate profile. Separate Evidence from Inference. Do not infer protected traits, job intent, or claim clearance verification. Never invent candidates or contact info.\n\nRole: ${role?.roleTitle || 'Unknown'}\nCandidate: ${candidate.name}\nSources: ${candidate.sourceProfiles.map(p=>`${p.source}: ${p.url}`).join('\n')}\nEvidence: ${candidate.evidence.map(e=>`- [${e.source}] ${e.label}: ${e.detail}`).join('\n')}\n\nReturn JSON with facts, inferences, conflicts, hmPitch, outreachAngle, verifyNext.`; }
export function updateProjectMemory(memory: ProjectMemory, feedback: FeedbackEvent, candidate?: SourcedCandidate): ProjectMemory { const skills = candidate?.matchedSkills.slice(0,4).join(', '); const note = `${feedback.label}: ${feedback.note || candidate?.name || 'candidate'}${skills ? ` · signals: ${skills}` : ''}`; const positive = ['strong_fit','good_fit','great_signal'].includes(feedback.label); const negative = ['bad_fit','too_junior','too_senior','wrong_location','wrong_domain','wrong_clearance'].includes(feedback.label); return { positivePatterns: positive ? uniq([note, ...memory.positivePatterns]).slice(0,20) : memory.positivePatterns, negativePatterns: negative ? uniq([note, ...memory.negativePatterns]).slice(0,20) : memory.negativePatterns, cautionPatterns: feedback.label === 'maybe' ? uniq([note, ...memory.cautionPatterns]).slice(0,20) : memory.cautionPatterns, rediscoveryNotes: uniq([`Rediscovery should prioritize candidates with ${skills || 'confirmed positive patterns'} and avoid repeated rejected patterns.`, ...memory.rediscoveryNotes]).slice(0,15), updatedAt:now() };
}
export function rediscoverCandidates(candidates: SourcedCandidate[], memory: ProjectMemory, role?: RoleAnalysis) { const positives = memory.positivePatterns.join(' ').toLowerCase(); return rankCandidates(candidates.map(c => { const boost = c.demoOnly ? 0 : c.matchedSkills.filter(s => positives.includes(lower(s))).length * 4 + (role ? c.matchedSkills.filter(s => role.keywords.includes(lower(s))).length * 2 : 0); return { ...c, fitScore: Math.min(99, c.fitScore + boost), lastRediscoveredAt: now(), evidence:[evidence('Rediscovery memory match', boost ? `Boosted by project memory and role keyword overlap (+${boost}).` : 'Reviewed in rediscovery pass.', c.demoOnly ? 'manual_demo' : 'manual', undefined, .55), ...c.evidence] }; })); }
