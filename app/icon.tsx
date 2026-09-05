import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #061018 0%, #102f3b 100%)',
        }}
      >
        <div
          style={{
            width: 330,
            height: 330,
            borderRadius: 96,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f59e0b',
            color: '#061018',
            fontFamily: 'Arial, sans-serif',
            fontSize: 210,
            fontWeight: 900,
            letterSpacing: -12,
          }}
        >
          S
        </div>
      </div>
    ),
    size,
  )
}
