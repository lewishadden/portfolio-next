/**
 * Splits items into rows with a reverse-pyramid taper at the bottom.
 * Full rows fill to `cols`. When there is a remainder, one full row is
 * borrowed and combined with the leftover to form two balanced, centered
 * taper rows (e.g. 3+1 → 2+2).
 */
export const buildPyramidRows = <T,>(items: T[], cols: number): T[][] => {
  const total = items.length;
  if (total === 0) return [];

  const rows: T[][] = [];
  const remainder = total % cols;
  let offset = 0;

  if (remainder === 0) {
    for (let r = 0; r < total / cols; r += 1) {
      rows.push(items.slice(offset, offset + cols));
      offset += cols;
    }
    return rows;
  }

  const fullRowsAvailable = Math.floor(total / cols);

  // Not enough items for even one full row — single centered row
  if (fullRowsAvailable === 0) {
    return [items.slice(0)];
  }

  // Borrow one full row; split pool into two balanced taper rows
  const fullRowCount = fullRowsAvailable - 1;
  const pool = cols + remainder;
  const firstTaper = Math.ceil(pool / 2);
  const secondTaper = pool - firstTaper;

  for (let r = 0; r < fullRowCount; r += 1) {
    rows.push(items.slice(offset, offset + cols));
    offset += cols;
  }

  rows.push(items.slice(offset, offset + firstTaper));
  offset += firstTaper;

  if (secondTaper > 0) {
    rows.push(items.slice(offset, offset + secondTaper));
  }

  return rows;
};
