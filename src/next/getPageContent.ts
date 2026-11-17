import type { Metadata } from 'next';
import type { CmsConfig, CmsStorageAdapter } from '../core/types';
import { findPage } from '../core/defineCms';
import { mergePageContent } from '../core/merge';

/** Shape of the optional "seo" section a page can define in its defaults. */
export interface PageSeoConfig {
  title?: string;
  description?: string;
  keywords?: string | string[];
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  /** e.g. "index, follow" or "noindex, nofollow". */
  robots?: string;
}

/**
 * Load a page's published content on the server (Server Components,
 * generateMetadata, getServerSideProps). Falls back to the page defaults when
 * storage is unreachable, so a storage outage never breaks rendering.
 */
export async function getPageContent<T = Record<string, unknown>>(
  config: Pick<CmsConfig, 'pages'>,
  pageKey: string,
  options: { storage: CmsStorageAdapter; includeDrafts?: boolean }
): Promise<T> {
  const page = findPage(config, pageKey);
  if (!page) throw new Error(`[visual-cms] Unknown page "${pageKey}".`);
  try {
    const records = await options.storage.listRecords(pageKey, { includeDrafts: options.includeDrafts });
    return mergePageContent<T>(page, records, { includeDrafts: options.includeDrafts });
  } catch {
    return mergePageContent<T>(page, []);
  }
}

/** Build Next.js metadata from a page's editable "seo" section, on top of a fallback. */
export function buildPageMetadata(content: { seo?: PageSeoConfig } | Record<string, unknown>, fallback: Metadata = {}): Metadata {
  const seo = (content as { seo?: PageSeoConfig }).seo;
  if (!seo || typeof seo !== 'object') return fallback;

  const keywords = Array.isArray(seo.keywords)
    ? seo.keywords
    : typeof seo.keywords === 'string'
      ? seo.keywords.split(',').map((k) => k.trim()).filter(Boolean)
      : fallback.keywords;

  // "noindex" contains "index", so test for the negative forms explicitly.
  const robots = (seo.robots ?? '').toLowerCase();
  const index = !/\bnoindex\b/.test(robots);
  const follow = !/\bnofollow\b/.test(robots);
  const fallbackTitle = typeof fallback.title === 'string' ? fallback.title : undefined;

  return {
    ...fallback,
    title: seo.title || fallback.title,
    description: seo.description || fallback.description,
    keywords,
    alternates: seo.canonical ? { ...fallback.alternates, canonical: seo.canonical } : fallback.alternates,
    openGraph: {
      ...fallback.openGraph,
      title: seo.ogTitle || seo.title || fallbackTitle,
      description: seo.ogDescription || seo.description || fallback.description || undefined,
      url: seo.canonical || (fallback.openGraph?.url as string | undefined),
      images: seo.ogImage ? [{ url: seo.ogImage }] : fallback.openGraph?.images,
    },
    twitter: {
      ...fallback.twitter,
      card: seo.twitterCard || 'summary_large_image',
      title: seo.ogTitle || seo.title || fallbackTitle,
      description: seo.ogDescription || seo.description || fallback.description || undefined,
      images: seo.ogImage ? [seo.ogImage] : fallback.twitter?.images,
    },
    robots: seo.robots ? { index, follow } : fallback.robots,
  };
}

/** Convenience for `generateMetadata`: load the page and build its metadata. */
export async function getPageMetadata(
  config: Pick<CmsConfig, 'pages'>,
  pageKey: string,
  options: { storage: CmsStorageAdapter; fallback?: Metadata }
): Promise<Metadata> {
  const content = await getPageContent<Record<string, unknown>>(config, pageKey, { storage: options.storage });
  return buildPageMetadata(content, options.fallback);
}
