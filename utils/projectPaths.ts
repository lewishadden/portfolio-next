/** URL of a project's standalone page (also written by the grid's modal) */
export const projectPath = (slug: string) => `/projects/${slug}`;

/**
 * A project's title, before the site's name (the root layout's title
 * template adds it): "Drive King | Projects". Its page's metadata and the
 * projects modal (which sets document.title while open) both use it. It
 * lives here rather than in seo.ts, which reads content.json: client code
 * importing it would ship the whole file
 */
export const projectTitle = (name: string) => `${name.trim()} | Projects`;

/** The slug in `/projects/<slug>`, or null for any other path */
export function projectSlugFromPath(pathname: string) {
  const match = /^\/projects\/([^/]+)\/?$/.exec(pathname);
  return match ? decodeURIComponent(match[1]) : null;
}
