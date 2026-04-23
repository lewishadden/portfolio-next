'use client';

import { useRef, HTMLAttributes, ButtonHTMLAttributes } from 'react';
import { m, useScroll, useTransform, MotionProps } from 'framer-motion';

type RevealVariant = 'fade-up' | 'scale' | 'slide-left' | 'slide-right';

type ScrollRevealProps = MotionProps &
  Omit<HTMLAttributes<HTMLElement> & ButtonHTMLAttributes<HTMLButtonElement>, keyof MotionProps> & {
    as?: 'div' | 'li' | 'aside' | 'button' | 'h3';
    children?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    variant?: RevealVariant;
  };

export const ScrollReveal = ({
  children,
  as = 'div',
  style,
  variant = 'fade-up',
  className,
  ...props
}: ScrollRevealProps) => {
  const targetRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ['start 100%', 'start 55%'],
  });

  const opacity = useTransform(scrollYProgress, [0, 1], [0, 1]);

  const y = useTransform(
    scrollYProgress,
    [0, 1],
    variant === 'fade-up' ? [90, 0] : variant === 'scale' ? [40, 0] : [0, 0]
  );

  const x = useTransform(
    scrollYProgress,
    [0, 1],
    variant === 'slide-left' ? [-90, 0] : variant === 'slide-right' ? [90, 0] : [0, 0]
  );

  const scale = useTransform(scrollYProgress, [0, 1], variant === 'scale' ? [0.88, 1] : [1, 1]);

  const MotionComponent = m[as as keyof typeof m] as React.ElementType;

  return (
    <div
      ref={targetRef}
      className="reveal-trigger"
      style={{
        display: 'grid',
        width: '100%',
        height: '100%',
        gridTemplateColumns: '100%',
      }}
    >
      <MotionComponent
        className={className}
        style={{
          ...style,
          opacity,
          y,
          x,
          scale,
          gridArea: '1 / 1 / 2 / 2',
        }}
        {...props}
      >
        {children}
      </MotionComponent>
    </div>
  );
};
