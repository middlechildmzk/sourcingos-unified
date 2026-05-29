'use client'
import { useMemo, useState } from 'react'
import { trackClientEvent } from '@/lib/analytics'
const sources = [
  ['LinkedIn profiles','site:linkedin.com/in'],['GitHub','site:github.com'],['Public resumes','(intitle:resume OR inurl:resume OR filetype:pdf)'],['Stack Overflow','site:stackoverflow.com/users'],['Hugging Face','site:huggingface.co'],['OpenAlex','site:openalex.org/authors']
] as const
export function XrayTool(){
 const [source,setSource]=useState<string>(sources[1][1]); const [terms,setTerms]=useState('Kubernetes Terraform AWS GovCloud DevSecOps'); const [location,setLocation]=useState('Minneapolis OR Remote'); const [exclude,setExclude]=useState('jobs hiring course tutorial')
 const query=useMemo(()=>`${source} (${terms.split(/[,\n]/).join(' OR ')}) (${location}) ${exclude.split(/\s+/).filter(Boolean).map(x=>'-'+x).join(' ')}`,[source,terms,location,exclude])
 return <div className="interactive-tool"><label>Source</label><select className="input" value={source} onChange={e=>setSource(e.target.value)}>{sources.map(s=><option key={s[0]} value={s[1]}>{s[0]}</option>)}</select><label>Skill / title signals</label><textarea className="textarea" value={terms} onChange={e=>setTerms(e.target.value)} /><label>Location / context</label><input className="input" value={location} onChange={e=>setLocation(e.target.value)} /><label>Exclude</label><input className="input" value={exclude} onChange={e=>setExclude(e.target.value)} /><div className="result-card"><pre>{query}</pre><div className="button-row"><button onClick={()=>{navigator.clipboard?.writeText(query);trackClientEvent('copy_xray')}}>Copy</button><button onClick={()=>{trackClientEvent('launch_xray','google'); window.open('https://www.google.com/search?q='+encodeURIComponent(query),'_blank')}}>Open Google</button></div></div></div>
}
