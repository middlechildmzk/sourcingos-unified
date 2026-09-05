'use client'

import { RoleEvidenceSlateV33_2 } from '@/components/RoleEvidenceSlateV33_2'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

export function RoleEvidenceSlateContainerV33_2({ roleId }: { roleId: string }) {
  const { roles, mode } = useRoleWorkspaces()
  const role = roles.find(item => item.id === roleId)
  if (!role || mode === 'checking') return null
  return <RoleEvidenceSlateV33_2 role={role} />
}
