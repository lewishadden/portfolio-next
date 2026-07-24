# UI Overhaul — "Ember Atelier" (Warm Editorial)

**Date:** 2026-07-21
**Goal:** Massive visual overhaul: heavy animation, bespoke illustration, and an
art-directed editorial aesthetic that reads as designed-by-a-human — while keeping
the existing content model (`content.json`), accessibility, SEO, and both themes.

## Why this direction

The current v3 design is competent but assembled from recognisable AI-portfolio
tropes: gradient-outline mono headline, typing animation, glassy 3D clip-art,
canvas starfield, floating pill nav. The overhaul replaces the tropes with an
editorial "warm studio folio" language that keeps the deliberate **Ember** brand
palette (amber → orange → rose on espresso/paper) chosen in a recent redesign.

## Design language

### Typography

- **Display:** Fraunces (variable; `opsz`, `SOFT`, `WONK` axes) — a wonky,
  characterful serif that feels printed, not generated. Italics used for accent
  words inside headlines.
- **Body:** Instrument Sans — humanist grotesque, warm and neutral.
- **Labels/code flavour:** JetBrains Mono retained, demoted to eyebrows, index
  numerals, and small annotations (`// about`-style slugs stay).

### Palette

Ember hues retained. Dark = deep espresso; light = warm paper. All existing CSS
variable names preserved so components continue to work.

### Signature elements

1. **Editorial hero** — enormous Fraunces headline with an italic accent word,
   hand-drawn squiggle underline that draws itself in, word-by-word clip-path
   rise on load. Roles rendered as a mono ticker list, not a typing animation.
2. **Hand-drawn SVG doodle library** (`components/Doodles`) — squiggle
   underlines, sketchy arrows, asterisk sparks, scribbled circles, dotted
   flight paths. All animate via stroke draw-on when scrolled into view.
3. **Rotating circular text stamp** — "open to work" seal, slow spin,
   sticker-like.
4. **Marquee strips** — slow infinite tech/role tickers mixing italic serif and
   mono; `prefers-reduced-motion` pauses them.
5. **Ghost index numerals** — huge Fraunces "01/02/03" section numbering.
6. **Organic portrait treatment** — arch/blob mask + offset hand-drawn frame.
7. **Layered atmosphere background** — gradient orbs + faint topographic
   contour SVG replacing the canvas starfield; existing grain kept.

### What gets removed

- react-type-animation typing effect (package stays; usage removed)
- SVG outline-stroke name treatment
- `hero-3d-code-block.png` glass clip-art
- Canvas particle starfield
- Floating pill nav (replaced by full-width editorial hairline bar)

## Motion plan

- **Load:** orchestrated hero stagger (clip-path word rise, ~90ms stagger),
  doodles draw in after text lands.
- **Scroll:** existing `.reveal` / `useReveal` system retained; doodle draw-on
  via IntersectionObserver-added class; parallax accents via existing hooks.
- **Micro:** magnetic CTAs (existing `Magnet`), card tilt (existing `useTilt`),
  underline-slide links, marquee pause on hover.
- All gated by `prefers-reduced-motion` (existing global rules).

## Scope of change (files)

- `app/layout.tsx` — font swap (Fraunces + Instrument Sans + JetBrains Mono)
- `app/theme-variables.scss` — type scale + editorial tokens
- `app/page.scss` — shared section system: eyebrows, ghost numerals, titles
- `components/Doodles/*` — new SVG illustration library
- `components/Marquee/*` — new marquee strip
- `components/Home`, `StatsStrip`, `About`, `Experience`, `Projects`, `Skills`,
  `Contact`, `Header`, `Footer`, `Background` — page-level redesigns
- No changes to: `content.json` schema, routing, SEO metadata, contact API

## Non-goals

- No new runtime dependencies
- No content rewrites (all copy from `content.json` unchanged)
- No accessibility regressions (WCAG 2.1 AA retained)
