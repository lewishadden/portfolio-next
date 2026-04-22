'use client';

import { useRef, HTMLAttributes, ButtonHTMLAttributes } from 'react';
import { m, useScroll, useTransform, MotionProps } from 'framer-motion';

type ScrollRevealProps = MotionProps & Omit<HTMLAttributes<HTMLElement> & ButtonHTMLAttributes<HTMLButtonElement>, keyof MotionProps> & {
  as?: 'div' | 'li' | 'aside' | 'button' | 'h3';
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export const ScrollReveal = ({ children, as = 'div', style, ...props }: ScrollRevealProps) => {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 95%', 'start 40%']
  });

  const opacity = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [100, 0]);

  const MotionComponent = m[as as keyof typeof m] as React.ElementType;

  return (
    <MotionComponent
      ref={ref}
      style={{ ...style, opacity, y }}
      {...props}
    >
      {children}
    </MotionComponent>
  );
};
