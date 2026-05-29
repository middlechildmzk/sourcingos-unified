import { NextResponse } from 'next/server'
import { z } from 'zod'
const schema = z.object({ email: z.string().email(), role: z.string().optional(), focus: z.string().optional(), time: z.string().optional() })
export async function POST(req: Request){ const body = await req.json().catch(()=>null); const parsed = schema.safeParse(body); if(!parsed.success) return NextResponse.json({ ok:false, error:'Invalid waitlist payload' }, { status:400 }); console.log('SourcingOS waitlist signup', parsed.data); return NextResponse.json({ ok:true, mode:'preview', message:'Captured in preview. Connect ConvertKit/Beehiiv/Resend/Supabase in production.' }) }
