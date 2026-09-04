// Single source of truth for public navigation plus canonical authenticated product labels.

export type NavItem = {
  label: string
  href: string
  external?: boolean
}

export const publicNav: NavItem[] = [
  { label: 'Product', href: '/agentic-sourcing' },
  { label: 'Tools', href: '/tools' },
  { label: 'Methods', href: '/methods' },
  { label: 'Candidate Search', href: '/candidate-search' },
  { label: 'Training', href: '/training' },
  { label: 'Jobs', href: '/jobs' },
  { label: 'Guides', href: '/blog' },
  { label: 'Sign in', href: '/login' },
]

export const requestAccessCTA: NavItem = {
  label: 'Request access',
  href: '/waitlist',
}

export const appNav: NavItem[] = [
  { label: 'Today', href: '/app/today' },
  { label: 'Roles', href: '/app/roles' },
  { label: 'People Search', href: '/app/search' },
  { label: 'Talent', href: '/app/candidate-database' },
  { label: 'Sources', href: '/app/sources' },
]
