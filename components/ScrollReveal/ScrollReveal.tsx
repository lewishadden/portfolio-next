'use client';

import { useState, useSyncExternalStore } from 'react';

import { useInViewport } from '@/hooks/useInViewport';
import { useReducedMotion } from '@/hooks/useReducedMotion';

import type { CSSProperties, ReactNode } from 'react';

type ScrollRevealProps = {
  children: ReactNode;
  animation: string;
  duration?: number;
  delay?: number;
  className?: string;
  style?: CSSProperties;
};

const emptySubscribe = () => () => {};

const ScrollReveal = ({
  children,
  animation,
  duration,
  delay,
  className,
  style,
}: ScrollRevealProps) => {
  const { ref, inViewport } = useInViewport();
  const reduceMotion = useReducedMotion();
  const [isVisible, setIsVisible] = useState(false);
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (inViewport && !isVisible) {
    setIsVisible(true);
  }

  const animationClassName = isVisible && !reduceMotion ? `animated ${animation}` : '';
  const mergedStyle: CSSProperties = {
    ...style,
    ...(duration ? { animationDuration: `${duration}s` } : {}),
    ...(delay ? { animationDelay: `${delay}s` } : {}),
    opacity: isVisible ? undefined : isMounted ? 0 : undefined,
  };

  return (
    <div
      ref={ref}
      className={`${className ?? ''} ${animationClassName}`.trim()}
      style={mergedStyle}
    >
      {children}
    </div>
  );
};

export default ScrollReveal;
