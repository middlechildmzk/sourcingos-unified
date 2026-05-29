import { NextResponse } from 'next/server'
import { supabaseConfigured } from '@/lib/supabase-adapter'
export async function GET() { return NextResponse.json({ ok: true, persistence: supabaseConfigured() ? 'supabase_configured' : 'preview_memory_only', requiredEnv: ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'], note: supabaseConfigured() ? 'Candidate Graph can persist to Supabase.' : 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable durable Candidate Graph persistence.' }) }
// Route: /api/persistence/status
