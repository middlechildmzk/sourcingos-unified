import type { ReactNode } from 'react'

export default function CandidateSearchLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        /* The legacy tab badge counted people, evidence artifacts, publications,
           unresolved identities, and discovery lanes as one total. Accurate
           people/supporting counts are shown inside the Results panel instead. */
        .wb-tabs .wb-tab:nth-child(3) > span {
          display: none;
        }
      `}</style>
      {children}
    </>
  )
}
