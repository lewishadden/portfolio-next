/**
 * Accessibility utility functions
 */

/**
 * Check if user prefers reduced motion
 * @returns boolean indicating if reduced motion is preferred
 */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Get animation props based on user's motion preference
 * @param animateIn - The animation to use if motion is not reduced
 * @returns Animation props object or disabled animation
 */
export const getAnimationProps = (animateIn: string) => {
  if (prefersReducedMotion()) {
    return {
      animateIn: 'fadeIn',
      duration: 0.01,
      animateOnce: true,
    };
  }
  return {
    animateIn,
    animateOnce: true,
  };
};

/**
 * Hook to listen for changes in motion preference
 */
export const usePrefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;

  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  return mediaQuery.matches;
};
