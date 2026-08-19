'use client'
import { useMemo, useState } from 'react'
import { directoryTools } from '@/data/directoryTools'
import { trackClientEvent } from '@/lib/analytics'

const cats = ['All', ...Array.from(new Set(directoryTools.map(t=>t.category)))]

function badgeFor(category:string){
  if(category.includes('ATS') || category.includes('CRM')) return 'ATS/CRM workflow'
  if(category.includes('Healthcare')) return 'Healthcare source'
  if(category.includes('Research')) return 'Research context'
  if(category.includes('Clearance') || category.includes('GovCon')) return 'GovCon source'
  if(category.includes('Licensed Talent')) return 'Licensed talent platform'
  if(category.includes('AI Sourcing')) return 'Core sourcing tool'
  if(category.includes('Developer') || category.includes('Technical')) return 'Technical evidence'
  return 'Specialist tool'
}

export function DirectoryClient(){
 const [q,setQ]=useState(''); const [cat,setCat]=useState('All');
 const filtered=useMemo(()=>directoryTools.filter(t=>(cat==='All'||t.category===cat)&&(`${t.name} ${t.description} ${t.bestFor}`.toLowerCase().includes(q.toLowerCase()))),[q,cat]);
 return <div className="interactive-tool">
  <div className="cta"><strong>Review note:</strong> tool capabilities and pricing change. CISA KEV and NVD access were re-verified from their primary government sources on August 19, 2026. Other vendor pricing is labeled as unverified until its source review is completed.</div>
  <div className="filter-row"><input className="input" placeholder="Search tools, categories, use cases..." value={q} onChange={e=>{setQ(e.target.value);trackClientEvent('directory_search')}}/><select className="input" value={cat} onChange={e=>setCat(e.target.value)}>{cats.map(c=><option key={c}>{c}</option>)}</select></div>
  <div className="directory-grid">{filtered.map(t=><div className="card" key={t.id}><span className="kicker">{badgeFor(t.category)}</span><h3>{t.name}</h3><p className="muted">{t.description}</p><p><strong>Category:</strong> {t.category}</p><p><strong>Best for:</strong> {t.bestFor}</p><p><strong>Pricing/access:</strong> {t.pricingModel}</p><p className="muted" style={{fontSize:12}}>{t.reviewNote}</p></div>)}</div>
 </div>
}
