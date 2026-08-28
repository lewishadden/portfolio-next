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
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 80px',
        backgroundColor: '#15100a',
        backgroundImage: 'linear-gradient(135deg, #15100a 55%, #2a1a08 100%)',
        color: '#f5efe6',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 9999,
            backgroundColor: '#f59e0b',
          }}
        />
        <div style={{ display: 'flex', fontSize: 30, color: '#e0b35c', letterSpacing: 2 }}>
          portfolio.lewishadden.com
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', fontSize: 96, fontWeight: 700, lineHeight: 1.05 }}>
          {name}
        </div>
        <div style={{ display: 'flex', fontSize: 40, color: '#f59e0b', fontWeight: 600 }}>
          {role}
        </div>
      </div>

      <div style={{ display: 'flex', fontSize: 30, color: '#c9beab' }}>
        Freelance React & Next.js Developer — Peterborough, UK
      </div>
    </div>,
    { ...size }
  );
}
