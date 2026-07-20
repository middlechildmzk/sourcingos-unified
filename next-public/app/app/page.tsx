import { redirect } from 'next/navigation'

export const metadata = { title: 'SourcingOS App', robots: { index: false, follow: false } }

export default function Page() {
  redirect('/app/roles')
}
