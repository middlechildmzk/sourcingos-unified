'use client'
import { useState } from 'react'
import { trackClientEvent } from '@/lib/analytics'

type WaitlistStatus = 'idle' | 'loading' | 'ok' | 'error'

export function WaitlistForm(){
 const [email,setEmail]=useState(''); const [role,setRole]=useState('Technical sourcer'); const [focus,setFocus]=useState('Cleared / GovCon'); const [status,setStatus]=useState<WaitlistStatus>('idle'); const [message,setMessage]=useState('')
 async function submit(e:React.FormEvent){
  e.preventDefault();
  if(!email || status==='loading') return;
  setStatus('loading'); setMessage('Adding you to the private beta list...');
  const payload={email,role,focus,source_page:typeof window!=='undefined'?window.location.pathname:undefined};
  trackClientEvent('waitlist_submit',focus,{role});
  try{
   const res=await fetch('/api/waitlist',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
   const data=await res.json().catch(()=>null);
   if(!res.ok || !data?.ok){
    setStatus('error');
    setMessage(data?.error || 'Something went wrong. Please try again, or message us directly if it keeps failing.');
    return;
   }
   const local=JSON.parse(localStorage.getItem('sourcingos.public.waitlist')||'[]');
   localStorage.setItem('sourcingos.public.waitlist',JSON.stringify([payload,...local]));
   setStatus('ok');
   setMessage(data?.message || 'You are on the SourcingOS private beta list. We will send updates about Candidate Graph access, source-pack templates, and early workflow previews.');
  }catch{
   setStatus('error');
   setMessage('Something went wrong. Please try again, or message us directly if it keeps failing.');
  }
 }
 return <form className="interactive-tool" onSubmit={submit}>
  <label>Email</label><input className="input" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" disabled={status==='loading'}/>
  <label>Recruiting focus</label><select className="input" value={focus} onChange={e=>setFocus(e.target.value)} disabled={status==='loading'}><option>Cleared / GovCon</option><option>Technical</option><option>Cybersecurity</option><option>Healthcare</option><option>AI / ML</option><option>Agency / Search</option></select>
  <label>Your role</label><input className="input" value={role} onChange={e=>setRole(e.target.value)} disabled={status==='loading'} />
  <button className="btn" type="submit" disabled={status==='loading'}>{status==='loading'?'Adding you...':'Request private beta access'}</button>
  {message&&<div className="cta" role="status" aria-live="polite">{message}</div>}
 </form>
}
