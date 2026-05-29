'use client'
import { useMemo, useState } from 'react'
import { trackClientEvent } from '@/lib/analytics'

type Mode = 'Cleared DevSecOps' | 'Cyber / RMF' | 'RN / Healthcare' | 'AI / ML' | 'General Technical'
const presets: Record<Mode, { role: string; jd: string; must: string[]; titles: string[]; exclusions: string[] }> = {
  'Cleared DevSecOps': { role: 'Senior DevSecOps Engineer', jd: 'TS/SCI DevSecOps with AWS GovCloud, Terraform, Kubernetes, Docker, CI/CD, Linux, Python, RMF, ATO, NIST, FedRAMP, DoD.', titles: ['DevSecOps Engineer','Platform Engineer','Cloud Engineer','SRE'], must: ['Kubernetes','Terraform','Docker','CI/CD','AWS GovCloud','RMF','ATO','FedRAMP'], exclusions: ['help desk','desktop support','student','trainer','sales'] },
  'Cyber / RMF': { role: 'ISSO / RMF Analyst', jd: 'Cybersecurity role with RMF, ATO, NIST, FedRAMP, ISSO, ISSM, SIEM, Splunk, Security+, CISSP, DoD.', titles: ['ISSO','ISSM','Information System Security Officer','RMF Analyst','Cybersecurity Analyst'], must: ['RMF','ATO','NIST','FedRAMP','SIEM','Splunk','Security+'], exclusions: ['student','instructor','bootcamp','sales'] },
  'RN / Healthcare': { role: 'Registered Nurse', jd: 'RN with acute care, ICU, ER, NICU, BLS, ACLS, Epic, EMR, patient assessment, Twin Cities.', titles: ['Registered Nurse','RN','Clinical Nurse','Staff Nurse'], must: ['acute care','ICU','ER','BLS','ACLS','Epic','EMR'], exclusions: ['recruiter','instructor','student'] },
  'AI / ML': { role: 'Machine Learning Engineer', jd: 'ML engineer with Python, PyTorch, LLMs, RAG, embeddings, vector databases, MLOps, model evaluation.', titles: ['Machine Learning Engineer','AI Engineer','MLOps Engineer','LLM Engineer','Applied Scientist'], must: ['Python','PyTorch','LLM','RAG','embeddings','vector database','MLOps'], exclusions: ['student','course','bootcamp','prompt engineer'] },
  'General Technical': { role: 'Software Engineer', jd: 'Software engineer with TypeScript, React, Node, Python, AWS, Kubernetes, CI/CD.', titles: ['Software Engineer','Full Stack Engineer','Backend Engineer','Platform Engineer'], must: ['TypeScript','React','Node','Python','AWS','Kubernetes'], exclusions: ['student','intern','bootcamp'] }
}
function q(s:string){ return /\s|\//.test(s) ? `"${s}"` : s }
function or(xs:string[], max=10){ const clean=[...new Set(xs.filter(Boolean))].slice(0,max).map(q); return clean.length>1?`(${clean.join(' OR ')})`:clean[0]||'' }
function not(xs:string[], google=false){ return google?xs.map(x=>`-${q(x)}`).join(' '):`NOT (${xs.map(q).join(' OR ')})` }
function download(name:string, content:string){ const url=URL.createObjectURL(new Blob([content],{type:'text/markdown'})); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url) }
export function BooleanTool(){
  const [mode,setMode]=useState<Mode>('Cleared DevSecOps')
  const [role,setRole]=useState(presets['Cleared DevSecOps'].role)
  const [jd,setJd]=useState(presets['Cleared DevSecOps'].jd)
  const p = presets[mode]
  const outputs = useMemo(()=>{
    const text = `${role} ${jd}`.toLowerCase()
    const extra = p.must.filter(m=>text.includes(m.toLowerCase()) || text.includes(m.toLowerCase().replace('+','')))
    const must = [...new Set([...extra, ...p.must])]
    const titles = [...new Set([role, ...p.titles])]
    return [
      { label: 'LinkedIn Recruiter balanced', query: `${or(titles)} AND ${or(must.slice(0,8))} AND ${not(p.exclusions)}` },
      { label: 'LinkedIn narrow / high precision', query: `${or(titles)} AND ${or(must.slice(0,5))} AND ${or(must.slice(5,9))} AND ${not(p.exclusions)}` },
      { label: 'Google LinkedIn X-Ray', query: `site:linkedin.com/in ${or(titles)} ${or(must.slice(0,7))} ${not(p.exclusions,true)}` },
      { label: 'GitHub X-Ray', query: `site:github.com ${or(titles)} ${or(must.filter(x=>!['TS/SCI','Secret','RN','BLS'].includes(x)).slice(0,7))} ${not(p.exclusions,true)}` },
      { label: 'ATS / CRM rediscovery', query: `${or(titles.slice(0,4))} AND ${or(must.slice(0,5))} AND ${not(p.exclusions)}` },
    ]
  },[mode,role,jd,p])
  function choose(m:Mode){ setMode(m); setRole(presets[m].role); setJd(presets[m].jd); trackClientEvent('tool_mode','boolean:'+m) }
  return <div className="interactive-tool"><div className="mode-row">{(Object.keys(presets) as Mode[]).map(m=><button key={m} onClick={()=>choose(m)} className={m===mode?'active':''}>{m}</button>)}</div><label>Role</label><input className="input" value={role} onChange={e=>setRole(e.target.value)} /><label>JD / notes</label><textarea className="textarea" value={jd} onChange={e=>setJd(e.target.value)} /><div className="results">{outputs.map((o,i)=><div className="result-card" key={o.label}><div className="result-head"><strong>{o.label}</strong><span>String {i+1}</span></div><pre>{o.query}</pre><div className="button-row"><button onClick={()=>{navigator.clipboard?.writeText(o.query);trackClientEvent('copy_boolean',o.label)}}>Copy</button>{o.label.includes('X-Ray')&&<button onClick={()=>{trackClientEvent('launch_xray',o.label); window.open('https://www.google.com/search?q='+encodeURIComponent(o.query),'_blank')}}>Open Google</button>}</div></div>)}</div><button className="btn" onClick={()=>download('sourcingos-boolean-source-pack.md', outputs.map(o=>`## ${o.label}\n\n\`${o.query}\``).join('\n\n'))}>Download source pack</button></div>
}
