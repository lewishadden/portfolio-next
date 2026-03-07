import { ImageResponse } from 'next/og';

// Image metadata
export const size = {
  width: 64,
  height: 64,
};
export const contentType = 'image/svg+xml';

// Image generation
export default function Icon() {
  return new ImageResponse(
    <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#7c3aed" />
          <stop offset="50%" stop-color="#8b5cf6" />
          <stop offset="100%" stop-color="#ec4899" />
        </linearGradient>

        <linearGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#c084fc" />
          <stop offset="100%" stop-color="#f472b6" />
        </linearGradient>

        <filter id="softGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="64" height="64" rx="16" fill="#020617" />
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="14"
        fill="none"
        stroke="url(#ringGrad)"
        stroke-width="2.5"
        filter="url(#softGlow)"
      />
      <path
        d="M18 20 V44 H28"
        stroke="url(#textGrad)"
        stroke-width="5"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
      <path
        d="M38 20 V44 M38 32 H50 M50 20 V44"
        stroke="url(#textGrad)"
        stroke-width="5"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
    </svg>,
    // ImageResponse options
    {
      // For convenience, we can re-use the exported icons size metadata
      // config to also set the ImageResponse's width and height.
      ...size,
    }
  );
}
