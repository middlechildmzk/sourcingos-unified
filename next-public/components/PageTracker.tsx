'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { trackClientEvent } from '@/lib/analytics'
export function PageTracker(){
  const pathname = usePathname()
  useEffect(()=>{ trackClientEvent('page_view', pathname) }, [pathname])
  return null
}
