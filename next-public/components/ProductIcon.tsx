import type { SVGProps } from 'react'

export type ProductIconName =
  | 'today'
  | 'roles'
  | 'autosource'
  | 'candidates'
  | 'import'
  | 'search'
  | 'acquisition'
  | 'ledger'
  | 'network'
  | 'toolkit'

type ProductIconProps = SVGProps<SVGSVGElement> & {
  name: ProductIconName
}

const paths: Record<ProductIconName, React.ReactNode> = {
  today: <><path d="M12 3v4" /><path d="M12 17v4" /><path d="m4.22 4.22 2.83 2.83" /><path d="m16.95 16.95 2.83 2.83" /><path d="M3 12h4" /><path d="M17 12h4" /><path d="m4.22 19.78 2.83-2.83" /><path d="m16.95 7.05 2.83-2.83" /><circle cx="12" cy="12" r="3.25" /></>,
  roles: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 9h8" /><path d="M8 13h5" /><path d="M8 17h7" /></>,
  autosource: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /><path d="M11 7.5v7" /><path d="M7.5 11h7" /></>,
  candidates: <><circle cx="9" cy="8" r="3.5" /><path d="M3.5 19c.7-3.6 2.53-5.5 5.5-5.5s4.8 1.9 5.5 5.5" /><path d="M16 8.5a3 3 0 0 1 0 5" /><path d="M17 14.5c2.05.55 3.22 2.05 3.5 4.5" /></>,
  import: <><path d="M12 3v12" /><path d="m8 11 4 4 4-4" /><path d="M5 20h14" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 4.5 4.5" /></>,
  acquisition: <><path d="M4 18V6" /><path d="M4 18h16" /><path d="m7 14 4-4 3 3 5-6" /></>,
  ledger: <><path d="M6 3h10l3 3v15H6z" /><path d="M16 3v4h4" /><path d="M9 11h6" /><path d="M9 15h6" /></>,
  network: <><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="m8.2 10.9 7.5-3.8" /><path d="m8.2 13.1 7.5 3.8" /></>,
  toolkit: <><path d="M4 7h16" /><path d="M7 4v6" /><path d="M17 4v6" /><rect x="4" y="7" width="16" height="13" rx="2.5" /><path d="M8 13h3" /><path d="M13 13h3" /><path d="M8 17h8" /></>,
}

export function ProductIcon({ name, ...props }: ProductIconProps) {
  return <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    {paths[name]}
  </svg>
}
