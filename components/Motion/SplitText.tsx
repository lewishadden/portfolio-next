import './SplitText.scss';

/**
 * Letter-by-letter rise, driven purely by CSS so it starts on first paint
 * (no hydration wait — keeps the hero's LCP fast). Screen readers get the
 * plain string; the animated letters are aria-hidden.
 *
 * `gradient` paints each letter with its slice of the brand gradient, so the
 * word reads as one continuous gradient even though every letter moves alone.
 */
export function SplitText({
  text,
  delay = 0,
  stagger = 45,
  gradient = false,
  className = '',
}: {
  text: string;
  /** ms before the first letter */
  delay?: number;
  /** ms between letters */
  stagger?: number;
  gradient?: boolean;
  className?: string;
}) {
  const letters = Array.from(text);
  return (
    <span className={`split ${gradient ? 'split--gradient' : ''} ${className}`}>
      <span className="sr-only">{text}</span>
      <span className="split__letters" aria-hidden="true">
        {letters.map((letter, i) => (
          <span
            key={i}
            className="split__char"
            style={
              {
                '--i': i,
                '--n': letters.length,
                '--delay': `${delay + i * stagger}ms`,
              } as React.CSSProperties
            }
          >
            {letter === ' ' ? ' ' : letter}
          </span>
        ))}
      </span>
    </span>
  );
}

export default SplitText;
