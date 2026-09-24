import type { ExperienceItem } from '@/types';

const monthNames = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];

/** Splits "Jan 2025 - Jun 2026" (hyphen, en or em dash) into its two ends */
const splitRange = (years: string) => years.split(/\s*[-–—]\s*/).filter(Boolean);

/** "Jan 2025" → an absolute month count, or null when it can't be parsed */
const toMonthIndex = (value: string): number | null => {
  const match = /^([a-z]{3})[a-z]*\.?\s+(\d{4})$/i.exec(value.trim());
  if (!match) return null;
  const month = monthNames.indexOf(match[1].toLowerCase());
  return month < 0 ? null : Number(match[2]) * 12 + month;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Normalises the separator to a spaced en dash: "Jan 2025 – Jun 2026" */
export const formatRange = (years: string) => splitRange(years).join(' – ');

/**
 * Inclusive length of a role, e.g. { short: "1 yr 6 mos", long: "1 year 6 months" }.
 * Returns null for open-ended or unparseable ranges.
 */
export const roleDuration = (years: string): { short: string; long: string } | null => {
  const [from, to] = splitRange(years);
  if (!from || !to) return null;
  const start = toMonthIndex(from);
  const end = toMonthIndex(to);
  if (start === null || end === null || end < start) return null;

  const total = end - start + 1;
  const y = Math.floor(total / 12);
  const mo = total % 12;
  const short = [y && plural(y, 'yr'), mo && plural(mo, 'mo')].filter(Boolean).join(' ');
  const long = [y && plural(y, 'year'), mo && plural(mo, 'month')].filter(Boolean).join(' ');
  return { short, long };
};

/** Short monogram for the timeline node: an acronym-style first word, else initials */
export const companyInitials = (company: string) => {
  const words = company.split(/\s+/).filter(Boolean);
  const first = words[0] ?? '';
  if (/^[A-Z0-9&]{2,4}$/.test(first)) return first;
  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
};

/** Earliest four-digit year mentioned across every role */
export const firstYear = (items: ExperienceItem[]) => {
  const years = items.flatMap((item) => (item.years.match(/\d{4}/g) ?? []).map(Number));
  return years.length ? Math.min(...years) : null;
};
