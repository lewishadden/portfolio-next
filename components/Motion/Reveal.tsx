'use client';

import { m } from 'framer-motion';

import type { HTMLMotionProps } from 'framer-motion';

const ease = [0.16, 1, 0.3, 1] as const;

type RevealTag =
  | 'div'
  | 'li'
  | 'article'
  | 'aside'
  | 'section'
  | 'nav'
  | 'p'
  | 'h2'
  | 'h3'
  | 'span'
  | 'ul';

type RevealProps = Omit<HTMLMotionProps<'div'>, 'initial' | 'whileInView'> & {
  as?: RevealTag;
  delay?: number;
  /** Starting offset in px (vertical) */
  y?: number;
  /** Starting offset in px (horizontal) */
  x?: number;
  /** Starting scale */
  scale?: number;
  blur?: boolean;
  once?: boolean;
};

/** Fades, lifts and de-blurs its children the first time they scroll into view */
export function Reveal({
  as = 'div',
  delay = 0,
  y = 36,
  x = 0,
  scale = 1,
  blur = true,
  once = true,
  transition,
  viewport,
  ...props
}: RevealProps) {
  const Component = m[as] as typeof m.div;
  return (
    <Component
      initial={{ opacity: 0, y, x, scale, filter: blur ? 'blur(10px)' : 'blur(0px)' }}
      whileInView={{
        opacity: 1,
        y: 0,
        x: 0,
        scale: 1,
        filter: 'blur(0px)',
        // A lingering filter would stop descendant glass (backdrop-filter) seeing the 3D scene
        transitionEnd: { filter: 'none' },
      }}
      viewport={{ once, margin: '0px 0px -8% 0px', ...viewport }}
      transition={{ duration: 0.9, delay, ease, ...transition }}
      {...props}
    />
  );
}

/** Staggers direct <RevealItem> children as the group enters the viewport */
export function RevealGroup({
  as = 'div',
  stagger = 0.08,
  delay = 0,
  ...props
}: Omit<HTMLMotionProps<'div'>, 'initial' | 'whileInView' | 'variants'> & {
  as?: RevealTag;
  stagger?: number;
  delay?: number;
}) {
  const Component = m[as] as typeof m.div;
  return (
    <Component
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
      variants={{
        hidden: {},
        shown: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
      {...props}
    />
  );
}

export function RevealItem({
  as = 'div',
  y = 30,
  ...props
}: Omit<HTMLMotionProps<'div'>, 'variants'> & { as?: RevealTag; y?: number }) {
  const Component = m[as] as typeof m.div;
  return (
    <Component
      variants={{
        hidden: { opacity: 0, y, filter: 'blur(8px)' },
        shown: {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          transition: { duration: 0.8, ease },
          transitionEnd: { filter: 'none' },
        },
      }}
      {...props}
    />
  );
}
