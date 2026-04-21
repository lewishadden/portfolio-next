'use client';

import { useGlobalReveal } from '@/hooks/useReveal';

export function RevealMount() {
  useGlobalReveal();
  return null;
}

export default RevealMount;
