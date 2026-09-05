import { RoleWorkspaceV37 } from '@/components/RoleWorkspaceV37'

export const metadata = {
  title: 'Role Workspace | SourcingOS',
  robots: { index: false, follow: false },
}

export default async function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RoleWorkspaceV37 roleId={id} />
}
