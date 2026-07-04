// Single source of truth for site navigation.
// Public-facing product is "Candidate Search"; "Candidate Graph" is the internal data layer.

export type NavItem = {
  label: string
  href: string
  external?: boolean
}

export const publicNav: NavItem[] = [
  { label: 'Free Tools', href: '/tools' },
  { label: 'Sourcing Vault', href: '/methods' },
  { label: 'Candidate Search', href: '/candidate-search' },
  { label: 'Training', href: '/training' },
  { label: 'Jobs', href: '/jobs' },
  { label: 'Directory', href: '/directory' },
  { label: 'Guides', href: '/blog' },
]

export const requestAccessCTA: NavItem = {
  label: 'Request access',
  href: '/waitlist',
}

export const appNav: NavItem[] = [
  { label: 'Candidate Search', href: '/app/candidate-search' },
  { label: 'Candidate Database', href: '/app/candidate-database' },
  { label: 'Candidate 360', href: '/app/candidate-database' },
]
