import './Stamp.scss';

/**
 * Rotating circular-text seal, sticker-style. Decorative only — the
 * information it carries must also exist as real text elsewhere.
 */
export const Stamp = ({
  text,
  id = 'stamp-ring',
  className = '',
  children,
}: {
  text: string;
  /** Unique per page — SVG defs ids are document-global. */
  id?: string;
  className?: string;
  children?: React.ReactNode;
}) => (
  <div className={`stamp ${className}`} aria-hidden="true">
    <svg className="stamp__ring" viewBox="0 0 120 120" focusable="false">
      <defs>
        <path id={id} d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" />
      </defs>
      <text className="stamp__text">
        <textPath href={`#${id}`} startOffset="0">
          {text}
        </textPath>
      </text>
    </svg>
    <span className="stamp__center">{children ?? '✳'}</span>
  </div>
);
