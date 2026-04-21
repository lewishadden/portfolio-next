'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

import { useReducedMotion } from '@/hooks/useReducedMotion';

import './Background.scss';

type IdleDeadlineLike = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type IdleCallbackLike = (deadline: IdleDeadlineLike) => void;

export const Background = () => {
  const [ready, setReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reducedMotion = useReducedMotion();

  const requestIdle = useCallback((cb: IdleCallbackLike) => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      return requestIdleCallback(cb, { timeout: 4000 });
    }
    const start = Date.now();
    return setTimeout(() => {
      cb({
        didTimeout: false,
        timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
      });
    }, 400);
  }, []);

  const cancelIdle = useCallback((id: number) => {
    if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
      cancelIdleCallback(id);
    } else {
      clearTimeout(id);
    }
  }, []);

  useEffect(() => {
    const id = requestIdle(() => setReady(true)) as number;
    return () => cancelIdle(id);
  }, [requestIdle, cancelIdle]);

  useEffect(() => {
    if (!ready || reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let particles: {
      x: number;
      y: number;
      r: number;
      vx: number;
      vy: number;
      a: number;
    }[] = [];
    let raf = 0;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const isMobile = window.innerWidth < 768;
    const count = isMobile ? 36 : 60;

    const resize = () => {
      w = canvas.width = canvas.offsetWidth * dpr;
      h = canvas.height = canvas.offsetHeight * dpr;
    };
    const reset = () => {
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: (Math.random() * 2 + 0.5) * dpr,
        vy: -(Math.random() * 0.4 + 0.1) * dpr,
        vx: (Math.random() - 0.5) * 0.2 * dpr,
        a: Math.random() * 0.6 + 0.2,
      }));
    };

    const getColor = () =>
      getComputedStyle(document.documentElement).getPropertyValue('--bg-particle-color').trim() ||
      '#9fb8ff';

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const color = getColor();
      ctx.fillStyle = color;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) {
          p.y = h + 10;
          p.x = Math.random() * w;
        }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        ctx.globalAlpha = p.a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    reset();
    draw();

    const onResize = () => {
      resize();
      reset();
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [ready, reducedMotion]);

  return (
    <div className="bg-container" aria-hidden="true">
      <div className="bg-container__dots" />
      {ready && (
        <>
          <div className="bg-container__orb bg-container__orb--1" />
          <div className="bg-container__orb bg-container__orb--2" />
          <div className="bg-container__orb bg-container__orb--3" />
          {!reducedMotion && <canvas ref={canvasRef} className="bg-container__particles" />}
          <div className="bg-container__scan" />
          <div className="bg-container__grain" />
        </>
      )}
    </div>
  );
};

export default Background;
