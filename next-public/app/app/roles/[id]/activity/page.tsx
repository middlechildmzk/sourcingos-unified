import { RoleActivityV37 } from '@/components/RoleActivityV37'

export const metadata = { title: 'Role Activity | SourcingOS', robots: { index: false, follow: false } }

export default async function RoleActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RoleActivityV37 roleId={id} />
}
