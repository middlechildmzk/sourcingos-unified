import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'SourcingOS — Find who your search missed.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: 'linear-gradient(135deg, #061018 0%, #0c2230 48%, #102f3b 100%)',
          color: '#f8fafc',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f59e0b',
              color: '#061018',
              fontSize: 34,
              fontWeight: 900,
            }}
          >
            S
          </div>
          <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: -1 }}>SourcingOS</div>
        </div>
        <div>
          <div style={{ fontSize: 82, lineHeight: 0.95, fontWeight: 900, letterSpacing: -4, maxWidth: 940 }}>
            Find who your search missed.
          </div>
          <div style={{ marginTop: 28, fontSize: 30, lineHeight: 1.3, color: '#cbd5e1', maxWidth: 920 }}>
            Human-approved sourcing intelligence for hard-to-fill technical, cleared, healthcare, cyber, and AI roles.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 24, color: '#f8fafc' }}>
          <span style={{ padding: '12px 18px', borderRadius: 999, background: 'rgba(255,255,255,.12)' }}>Public evidence</span>
          <span style={{ padding: '12px 18px', borderRadius: 999, background: 'rgba(255,255,255,.12)' }}>Recruiter confirmed</span>
          <span style={{ padding: '12px 18px', borderRadius: 999, background: 'rgba(255,255,255,.12)' }}>No silent merges</span>
        </div>
      </div>
    ),
    size,
  )
}
