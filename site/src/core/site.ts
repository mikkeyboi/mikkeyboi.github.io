/**
 * Where the rest of the site lives. On the published site the CV sits at the root next to
 * /posts and /playground; in the private preview (served under /static/) links point at the
 * public site instead.
 */
export const SITE = typeof location !== 'undefined' && location.pathname.startsWith('/static/') ? 'https://minwahleung.ca' : '';

export const siteUrl = (path: string): string => `${SITE}${path}`;
