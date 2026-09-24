/**
 * Brand icons drawn in solid black ink (no colour of their own). They vanish
 * on the dark theme, so they get the `tech-ink` class, which inverts them there.
 */
const inkIcons = new Set([
  'devicon:nextjs',
  'devicon:vercel',
  'devicon:threejs',
  'devicon:cypressio',
  'logos:aws',
]);

export const techIconClass = (icon: string) => (inkIcons.has(icon) ? 'tech-ink' : undefined);
