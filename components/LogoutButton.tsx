'use client'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser'

interface LogoutButtonProps {
  compact?: boolean
}

export function LogoutButton({ compact }: LogoutButtonProps) {
  const router = useRouter()

  async function handleLogout() {
    const sb = createBrowserSupabaseClient()
    if (sb) await sb.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="btn ghost"
      style={{
        fontSize: '12px',
        padding: compact ? '6px 12px' : '8px 14px',
        borderRadius: '999px',
      }}
    >
      Sign out
    </button>
  )
}
