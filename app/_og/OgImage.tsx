import { readFile } from 'fs/promises';
import path from 'path';
import { ImageResponse } from 'next/og';

import content from '../../content/content.json';

/**
 * Shared Open Graph card for every route: the page's station render on the
 * right (PNG copies made by scripts/generate-og-renders.mjs — satori cannot
 * read WebP), eyebrow + title + gradient accent + summary on the left.
 * Rendered at build time; `_og` is a private folder, so nothing here is routed.
 *
 * Fonts are the site's own (Unbounded, Geist, Geist Mono — SIL OFL), as Latin
 * WOFF subsets from Google Fonts: satori reads TTF/OTF/WOFF but not WOFF2.
 */

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = 'image/png';

export const personName = content.home?.name || 'Lewis Hadden';

export type OgRender = 'astronaut' | 'helmet' | 'satellite' | 'terminal' | 'rocket';

const colors = {
  background: '#05060d',
  text: '#eef0ff',
  muted: '#a6abcc',
  violet: '#a78bfa',
  cyan: '#22d3ee',
  lime: '#bef264',
  border: 'rgba(167, 139, 250, 0.35)',
};

const gradientText = {
  backgroundImage: `linear-gradient(90deg, ${colors.violet}, ${colors.cyan})`,
  backgroundClip: 'text',
  color: 'transparent',
} as const;

const ogDir = path.join(process.cwd(), 'app/_og');

async function renderDataUri(render: OgRender) {
  const file = path.join(ogDir, 'renders', `${render}.png`);
  return `data:image/png;base64,${(await readFile(file)).toString('base64')}`;
}

let fonts: Promise<NonNullable<ConstructorParameters<typeof ImageResponse>[1]>['fonts']> | null =
  null;

function loadFonts() {
  const font = (file: string) => readFile(path.join(ogDir, 'fonts', file));
  fonts ??= Promise.all([
    font('Unbounded-Bold.woff'),
    font('Geist-Regular.woff'),
    font('GeistMono-Medium.woff'),
  ]).then(([display, body, mono]) => [
    { name: 'Unbounded', data: display, weight: 700 as const, style: 'normal' as const },
    { name: 'Geist', data: body, weight: 400 as const, style: 'normal' as const },
    { name: 'Geist Mono', data: mono, weight: 500 as const, style: 'normal' as const },
  ]);
  return fonts;
}

const mono = { fontFamily: 'Geist Mono' } as const;

/** Cut to whole words so long copy never overflows the card */
function clip(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, text.lastIndexOf(' ', max - 1));
  return `${cut.replace(/[\s,.;:—–-]+$/, '')}…`;
}

export interface OgImageOptions {
  /** Section number shown in the eyebrow pill, e.g. "03" */
  index?: string;
  label: string;
  title: string;
  /** Gradient word(s) after the title */
  accent?: string;
  description?: string;
  /** Small pills along the bottom (years, technologies…) */
  chips?: string[];
  render?: OgRender;
}

export async function renderOgImage({
  index,
  label,
  title,
  accent,
  description,
  chips = [],
  render,
}: OgImageOptions) {
  const [image, fontData] = await Promise.all([render ? renderDataUri(render) : null, loadFonts()]);
  const headline = `${title} ${accent ?? ''}`.trim();
  const titleSize = headline.length > 26 ? 52 : headline.length > 16 ? 62 : 76;

  return new ImageResponse(
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        padding: '60px 72px',
        backgroundColor: colors.background,
        backgroundImage:
          'radial-gradient(circle at 82% 38%, rgba(139, 92, 246, 0.5), transparent 42%), radial-gradient(circle at 8% 100%, rgba(34, 211, 238, 0.3), transparent 45%)',
        color: colors.text,
        fontFamily: 'Geist',
      }}
    >
      {/* Orbit rings behind the station render */}
      <div
        style={{
          position: 'absolute',
          right: -60,
          top: 45,
          width: 540,
          height: 540,
          borderRadius: 9999,
          border: `2px solid ${colors.border}`,
          display: 'flex',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 30,
          top: 135,
          width: 360,
          height: 360,
          borderRadius: 9999,
          border: '2px dashed rgba(34, 211, 238, 0.55)',
          display: 'flex',
        }}
      />
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- satori markup, not a page
        <img
          src={image}
          width={430}
          height={430}
          style={{ position: 'absolute', right: 0, top: 100, objectFit: 'contain' }}
        />
      ) : (
        // No render (skills): a glowing core with planets on the rings
        [
          { x: 940, y: 265, size: 100, glow: 80 },
          { x: 813, y: 244, size: 22, glow: 24 },
          { x: 1071, y: 462, size: 30, glow: 30 },
          { x: 1177, y: 118, size: 18, glow: 20 },
          { x: 760, y: 470, size: 14, glow: 16 },
        ].map(({ x, y, size, glow }) => (
          <div
            key={`${x}-${y}`}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: 9999,
              backgroundImage: `linear-gradient(135deg, ${colors.violet}, ${colors.cyan})`,
              boxShadow: `0 0 ${glow}px rgba(139, 92, 246, 0.9)`,
              display: 'flex',
            }}
          />
        ))
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: 700,
          height: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 9999,
              backgroundColor: colors.lime,
              boxShadow: `0 0 16px ${colors.lime}`,
            }}
          />
          <div
            style={{
              display: 'flex',
              fontSize: 22,
              color: colors.muted,
              letterSpacing: 3,
              ...mono,
            }}
          >
            PORTFOLIO.LEWISHADDEN.COM
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            {index && (
              <div
                style={{
                  display: 'flex',
                  padding: '4px 14px',
                  borderRadius: 9999,
                  border: `2px solid ${colors.border}`,
                  fontSize: 22,
                  color: colors.text,
                  ...mono,
                }}
              >
                {index}
              </div>
            )}
            <div
              style={{ display: 'flex', width: 56, height: 2, backgroundColor: colors.border }}
            />
            <div
              style={{
                display: 'flex',
                fontSize: 22,
                letterSpacing: 5,
                textTransform: 'uppercase',
                color: colors.cyan,
                ...mono,
              }}
            >
              {label}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              columnGap: 22,
              fontFamily: 'Unbounded',
              fontSize: titleSize,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: -2,
            }}
          >
            {title && <div style={{ display: 'flex' }}>{title}</div>}
            {accent && <div style={{ display: 'flex', ...gradientText }}>{accent}</div>}
          </div>

          {description && (
            <div
              style={{
                display: 'flex',
                maxWidth: 660,
                fontSize: 28,
                lineHeight: 1.4,
                color: colors.muted,
              }}
            >
              {clip(description, 120)}
            </div>
          )}
        </div>

        {chips.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {chips.slice(0, 5).map((chip) => (
              <div
                key={chip}
                style={{
                  display: 'flex',
                  padding: '8px 18px',
                  borderRadius: 9999,
                  border: `2px solid ${colors.border}`,
                  backgroundColor: 'rgba(14, 16, 32, 0.7)',
                  fontSize: 20,
                  color: colors.text,
                  ...mono,
                }}
              >
                {chip}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', fontSize: 26, color: colors.muted }}>
            {`${personName} · Freelance React & Next.js Developer`}
          </div>
        )}
      </div>
    </div>,
    { ...ogSize, fonts: fontData }
  );
}
