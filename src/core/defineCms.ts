import type { CmsConfig, PageDef } from './types';

const KEY_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

/** True for keys safe to use as page or section identifiers in storage and URLs. */
export function isValidKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

/**
 * Validate and return a CMS configuration. Throws on duplicate or malformed keys
 * so mistakes surface at startup instead of as silent save failures.
 */
export function defineCms(config: CmsConfig): CmsConfig {
  const seen = new Set<string>();
  for (const page of config.pages) {
    if (!isValidKey(page.key)) {
      throw new Error(`[visual-cms] Invalid page key "${page.key}". Use letters, digits, "_" or "-".`);
    }
    if (seen.has(page.key)) {
      throw new Error(`[visual-cms] Duplicate page key "${page.key}".`);
    }
    seen.add(page.key);
    if (!page.route.startsWith('/')) {
      throw new Error(`[visual-cms] Page "${page.key}" route must start with "/".`);
    }
    const sectionKeys = new Set<string>();
    for (const section of page.sections) {
      if (!isValidKey(section.key)) {
        throw new Error(`[visual-cms] Invalid section key "${section.key}" on page "${page.key}".`);
      }
      if (sectionKeys.has(section.key)) {
        throw new Error(`[visual-cms] Duplicate section key "${section.key}" on page "${page.key}".`);
      }
      sectionKeys.add(section.key);
    }
  }
  return config;
}

export function findPage(config: Pick<CmsConfig, 'pages'>, pageKey: string): PageDef | undefined {
  return config.pages.find((p) => p.key === pageKey);
}
