'use client'
import { useEffect, useState } from 'react'
import type { AnalyticsEvent } from '@/lib/analytics'
export function AdminAnalytics(){ const [events,setEvents]=useState<AnalyticsEvent[]>([]); useEffect(()=>{setEvents(JSON.parse(localStorage.getItem('sourcingos.public.analytics')||'[]'))},[]); const counts=events.reduce((a,e)=>{a[e.type]=(a[e.type]||0)+1; return a},{} as Record<string,number>); return <div className="interactive-tool"><h2>Local analytics preview</h2><div className="grid">{Object.entries(counts).map(([k,v])=><div className="card" key={k}><strong>{k}</strong><p className="big-number">{v}</p></div>)}</div><h3>Recent events</h3>{events.slice(0,30).map((e,i)=><p key={i} className="muted">{e.time} — {e.type} — {e.path} {e.label}</p>)}</div> }
