type CodeIconProps = {
  className?: string;
  size?: number | string;
  strokeWidth?: number;
  showRing?: boolean;
};

const CodeIcon = ({ className, size = 150, strokeWidth = 7, showRing = true }: CodeIconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 160 160"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="homeHeaderGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#a78bfa" />
        <stop offset="50%" stopColor="#60a5fa" />
        <stop offset="100%" stopColor="#34d399" />
        <animate attributeName="x1" values="0%;100%;0%" dur="6s" repeatCount="indefinite" />
        <animate attributeName="x2" values="100%;200%;100%" dur="6s" repeatCount="indefinite" />
      </linearGradient>
    </defs>

    {showRing && (
      <circle
        cx="80"
        cy="80"
        r="68"
        stroke="url(#homeHeaderGradient)"
        strokeWidth="2"
        fill="none"
        opacity="0.35"
        strokeDasharray="428"
        strokeDashoffset="0"
      >
        <animate
          attributeName="stroke-dashoffset"
          values="0;428;0"
          dur="8s"
          repeatCount="indefinite"
        />
      </circle>
    )}

    {/* Left chevron */}
    <polyline
      points="62,45 28,80 62,115"
      stroke="url(#homeHeaderGradient)"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />

    {/* Right chevron */}
    <polyline
      points="98,45 132,80 98,115"
      stroke="url(#homeHeaderGradient)"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

export default CodeIcon;
