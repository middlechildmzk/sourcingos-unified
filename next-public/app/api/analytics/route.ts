import { NextResponse } from 'next/server'
export async function POST(req: Request){ const body = await req.json().catch(()=>null); console.log('SourcingOS analytics preview', body); return NextResponse.json({ ok:true }) }
