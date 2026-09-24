export interface BentoCell {
  /** Column span in the 3-column (wide screen) grid */
  lg: number;
  /** Column span in the 2-column (tablet) grid */
  md: number;
  /** Reveal delay (s) from the card's position in its wide-screen row */
  delay: number;
}

/**
 * Bento spans for the projects grid, worked out per breakpoint so every row
 * tiles exactly whatever the (filtered) number of cards.
 *
 * - 3 columns: rows of [wide + single] with the wide card alternating sides,
 *   interleaved with rows of three singles. Row sizes flex near the end so a
 *   lone card is never stranded.
 * - 2 columns: a full-width feature, then two rows of pairs, repeating. A
 *   leftover single stretches full width.
 */
export function bentoLayout(count: number): BentoCell[] {
  const lg: number[] = [];
  const rowPos: number[] = [];
  let remaining = count;
  let row = 0;
  let wideFirst = true;

  while (remaining > 0) {
    let size = row % 2 === 0 ? 2 : 3;
    if (remaining < size) size = remaining;
    else if (remaining - size === 1) size = size === 2 ? 3 : 2;

    let spans = [1, 1, 1];
    if (size === 1) spans = [3];
    if (size === 2) {
      spans = wideFirst ? [2, 1] : [1, 2];
      wideFirst = !wideFirst;
    }

    spans.forEach((span, i) => {
      lg.push(span);
      rowPos.push(i);
    });
    remaining -= size;
    row += 1;
  }

  const md: number[] = [];
  row = 0;
  while (md.length < count) {
    if (row % 3 === 0 || count - md.length === 1) md.push(2);
    else md.push(1, 1);
    row += 1;
  }

  return lg.map((span, i) => ({ lg: span, md: md[i], delay: rowPos[i] * 0.1 }));
}
