'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

import './CustomCursor.scss';

export const CustomCursor = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isHidden, setIsHidden] = useState(true);
  
  const pathname = usePathname();

  useEffect(() => {
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    if (isDesktop) {
      document.body.classList.add('has-custom-cursor');
    }
    return () => {
      document.body.classList.remove('has-custom-cursor');
    };
  }, []);

  useEffect(() => {
    const cursor = cursorRef.current;
    const ring = ringRef.current;
    if (!cursor || !ring) return;

    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;
    let isDesktop = window.matchMedia('(min-width: 768px)').matches;

    const onMouseMove = (e: MouseEvent) => {
      if (!isDesktop) return;
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (isHidden) setIsHidden(false);
      
      cursor.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
    };

    const onMouseDown = () => {
      if (isDesktop) cursor.classList.add('cursor-dot--clicked');
    };
    
    const onMouseUp = () => {
      if (isDesktop) cursor.classList.remove('cursor-dot--clicked');
    };

    const onMouseLeave = () => {
      setIsHidden(true);
    };

    const onMouseEnter = () => {
      setIsHidden(false);
    };

    const render = () => {
      if (isDesktop && !isHidden) {
        ringX += (mouseX - ringX) * 0.15;
        ringY += (mouseY - ringY) * 0.15;
        ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
      }
      requestAnimationFrame(render);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    document.body.addEventListener('mouseleave', onMouseLeave);
    document.body.addEventListener('mouseenter', onMouseEnter);

    const handleResize = () => {
      isDesktop = window.matchMedia('(min-width: 768px)').matches;
      if (!isDesktop) setIsHidden(true);
    };
    window.addEventListener('resize', handleResize);

    const raf = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.removeEventListener('mouseleave', onMouseLeave);
      document.body.removeEventListener('mouseenter', onMouseEnter);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(raf);
    };
  }, [isHidden]);

  useEffect(() => {
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest('a') || 
        target.closest('button') || 
        target.closest('.proj-row') || 
        target.closest('.skill-card') ||
        target.closest('.about__hl') ||
        target.closest('.contact__side') ||
        target.closest('.contact__panel')
      ) {
        setIsHovering(true);
      }
    };
    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest('a') || 
        target.closest('button') || 
        target.closest('.proj-row') || 
        target.closest('.skill-card') ||
        target.closest('.about__hl') ||
        target.closest('.contact__side') ||
        target.closest('.contact__panel')
      ) {
        setIsHovering(false);
      }
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
    };
  }, [pathname]);

  if (typeof window !== 'undefined' && !window.matchMedia('(min-width: 768px)').matches) {
    return null;
  }

  return (
    <>
      <div 
        ref={cursorRef} 
        className={`cursor-dot ${isHidden ? 'cursor-dot--hidden' : ''} ${isHovering ? 'cursor-dot--hover' : ''}`} 
        aria-hidden="true"
      />
      <div 
        ref={ringRef} 
        className={`cursor-ring ${isHidden ? 'cursor-ring--hidden' : ''} ${isHovering ? 'cursor-ring--hover' : ''}`} 
        aria-hidden="true"
      />
    </>
  );
};
