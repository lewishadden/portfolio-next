import { ImageResponse } from 'next/og';

import content from '../content/content.json';

export const alt = 'Lewis Hadden — Freelance React & Next.js Developer, Peterborough UK';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const name = content.home?.name || 'Lewis Hadden';
const role = content.home?.titles?.[0] || 'Senior Full Stack Engineer';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px 72px',
        backgroundColor: '#05060d',
        backgroundImage:
          'radial-gradient(circle at 85% 20%, rgba(139, 92, 246, 0.55), transparent 45%), radial-gradient(circle at 10% 90%, rgba(34, 211, 238, 0.35), transparent 45%)',
        color: '#eef0ff',
        fontFamily: 'sans-serif',
      }}
    >
      {/* Orbit rings */}
      <div
        style={{
          position: 'absolute',
          right: -120,
          top: 40,
          width: 560,
          height: 560,
          borderRadius: 9999,
          border: '2px solid rgba(167, 139, 250, 0.55)',
          display: 'flex',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: -40,
          top: 120,
          width: 400,
          height: 400,
          borderRadius: 9999,
          border: '2px dashed rgba(34, 211, 238, 0.6)',
          display: 'flex',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 110,
          top: 270,
          width: 100,
          height: 100,
          borderRadius: 9999,
          backgroundImage: 'linear-gradient(135deg, #a78bfa, #22d3ee)',
          boxShadow: '0 0 80px rgba(139, 92, 246, 0.9)',
          display: 'flex',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 9999,
            backgroundColor: '#bef264',
            boxShadow: '0 0 16px #bef264',
          }}
        />
        <div style={{ display: 'flex', fontSize: 26, color: '#a6abcc', letterSpacing: 3 }}>
          PORTFOLIO.LEWISHADDEN.COM
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div
          style={{
            display: 'flex',
            fontSize: 112,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: -4,
          }}
        >
          {name}
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 44,
            fontWeight: 700,
            backgroundImage: 'linear-gradient(90deg, #a78bfa, #22d3ee)',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          {role}
        </div>
      </div>

      <div style={{ display: 'flex', fontSize: 28, color: '#a6abcc' }}>
        Freelance React &amp; Next.js Developer — Peterborough, UK · UK &amp; EU remote
      </div>
    </div>,
    { ...size }
  );
}
