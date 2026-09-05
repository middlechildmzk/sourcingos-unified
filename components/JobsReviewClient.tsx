'use client'
import { useEffect, useState } from 'react'

type Submission = { id:string; email:string; companyName:string; jobTitle:string; jobUrl:string; salaryRange?:string; location?:string; remoteType?:string; notes?:string; status:string; submittedAt:string }

export function JobsReviewClient(){
 const [data,setData]=useState<{pending:Submission[];approved:Submission[];rejected:Submission[]}|null>(null)
 const [status,setStatus]=useState('')
 async function load(){ const res=await fetch('/api/jobs/review'); const json=await res.json(); setData(json) }
 useEffect(()=>{load().catch(()=>undefined)},[])
 async function decide(id:string, decision:'approved'|'rejected'){
  const res=await fetch('/api/jobs/review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id,status:decision})})
  const json=await res.json(); setStatus(json.ok?`${decision} submission`:json.error||'Update failed'); await load()
 }
 const all=[...(data?.pending||[]),...(data?.approved||[]),...(data?.rejected||[])]
 return <div className="interactive-tool">
  <div className="cta"><b>Review queue:</b> preview moderation layer. Production should use Supabase with role-gated admin access before public promotion.</div>
  {status?<div className="cta">{status}</div>:null}
  <div className="grid"><div className="card"><span className="kicker">Pending</span><div className="big-number">{data?.pending.length||0}</div></div><div className="card"><span className="kicker">Approved</span><div className="big-number">{data?.approved.length||0}</div></div><div className="card"><span className="kicker">Rejected</span><div className="big-number">{data?.rejected.length||0}</div></div></div>
  <div className="results">{all.map(s=><article className="result-card" key={s.id}><div className="result-head"><span>{s.status}</span><span>{new Date(s.submittedAt).toLocaleString()}</span></div><h3>{s.jobTitle}</h3><p className="muted"><strong>{s.companyName}</strong> · {s.location||'Location not listed'} · {s.remoteType||'Remote type not listed'} · {s.salaryRange||'Salary not listed'}</p><p>{s.notes}</p><p><a className="kicker" href={s.jobUrl} target="_blank" rel="noreferrer">Open apply URL</a></p><div className="button-row"><button onClick={()=>decide(s.id,'approved')}>Approve</button><button onClick={()=>decide(s.id,'rejected')}>Reject</button></div></article>)}</div>
 </div>
}
