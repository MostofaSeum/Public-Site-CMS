import { EDIT_MODE_PARAM, PREVIEW_PARAM } from './messages';

/** Absolute public URL of a route, using `publicSiteUrl` when the site runs on another origin. */
export function publicUrl(route: string, publicSiteUrl?: string): string {
  if (!publicSiteUrl) return route;
  return `${publicSiteUrl.replace(/\/+$/, '')}${route.startsWith('/') ? route : `/${route}`}`;
}

/** URL loaded in the studio's preview iframe. */
export function buildPreviewUrl(
  route: string,
  options: { publicSiteUrl?: string; editMode?: boolean; cacheBust?: number | string } = {}
): string {
  const base = publicUrl(route, options.publicSiteUrl);
  const params = [`${PREVIEW_PARAM}=1`];
  if (options.editMode) params.push(`${EDIT_MODE_PARAM}=1`);
  if (options.cacheBust !== undefined) params.push(`t=${encodeURIComponent(String(options.cacheBust))}`);
  return `${base}${base.includes('?') ? '&' : '?'}${params.join('&')}`;
}
