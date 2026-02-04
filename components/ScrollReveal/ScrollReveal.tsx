'use client';

import { useInViewport, useReducedMotion } from '@mantine/hooks';
import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

type ScrollRevealProps = {
  children: ReactNode;
  animation: string;
  duration?: number;
  delay?: number;
  className?: string;
  style?: CSSProperties;
};

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
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (inViewport) {
      setIsVisible(true);
    }
  }, [inViewport]);

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
