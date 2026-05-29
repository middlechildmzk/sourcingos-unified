'use client'
import { useState } from 'react'
import { trackClientEvent } from '@/lib/analytics'

export function WaitlistForm(){
 const [email,setEmail]=useState(''); const [role,setRole]=useState('Technical sourcer'); const [focus,setFocus]=useState('Cleared / GovCon'); const [status,setStatus]=useState('')
 async function submit(e:React.FormEvent){
  e.preventDefault();
  const payload={email,role,focus,time:new Date().toISOString()};
  const local=JSON.parse(localStorage.getItem('sourcingos.public.waitlist')||'[]');
  localStorage.setItem('sourcingos.public.waitlist',JSON.stringify([payload,...local]));
  trackClientEvent('waitlist_submit',focus,{role});
  try{ await fetch('/api/waitlist',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}) }catch{}
  setStatus('You are on the SourcingOS private beta list. We will send updates about Candidate Graph access, source-pack templates, and early workflow previews.');
 }
 return <form className="interactive-tool" onSubmit={submit}>
  <label>Email</label><input className="input" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com"/>
  <label>Recruiting focus</label><select className="input" value={focus} onChange={e=>setFocus(e.target.value)}><option>Cleared / GovCon</option><option>Technical</option><option>Cybersecurity</option><option>Healthcare</option><option>AI / ML</option><option>Agency / Search</option></select>
  <label>Your role</label><input className="input" value={role} onChange={e=>setRole(e.target.value)} />
  <button className="btn" type="submit">Request private beta access</button>
  {status&&<div className="cta">{status}</div>}
 </form>
}
