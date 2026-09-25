/** URL of a project's standalone page (also written by the grid's modal) */
export const projectPath = (slug: string) => `/projects/${slug}`;

/** The slug in `/projects/<slug>`, or null for any other path */
export function projectSlugFromPath(pathname: string) {
  const match = /^\/projects\/([^/]+)\/?$/.exec(pathname);
  return match ? decodeURIComponent(match[1]) : null;
}
