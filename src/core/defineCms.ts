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
      throw new Error(`[storio-editor] Invalid page key "${page.key}". Use letters, digits, "_" or "-".`);
    }
    if (seen.has(page.key)) {
      throw new Error(`[storio-editor] Duplicate page key "${page.key}".`);
    }
    seen.add(page.key);
    if (!page.route.startsWith('/')) {
      throw new Error(`[storio-editor] Page "${page.key}" route must start with "/".`);
    }
    if (page.collection !== undefined && !isValidKey(page.collection)) {
      throw new Error(`[storio-editor] Invalid collection "${page.collection}" on page "${page.key}".`);
    }
    if (/\[[^\]]+\]/.test(page.route) && !page.collection) {
      throw new Error(
        `[storio-editor] Page "${page.key}" has the route "${page.route}", which shows one record at a time. ` +
          'Add collection: "<key>" so the studio can list the records.'
      );
    }
    const sectionKeys = new Set<string>();
    for (const section of page.sections) {
      if (!isValidKey(section.key)) {
        throw new Error(`[storio-editor] Invalid section key "${section.key}" on page "${page.key}".`);
      }
      if (sectionKeys.has(section.key)) {
        throw new Error(`[storio-editor] Duplicate section key "${section.key}" on page "${page.key}".`);
      }
      sectionKeys.add(section.key);
    }
  }
  for (const page of config.pages) {
    if (!page.parent) continue;
    const parent = config.pages.find((p) => p.key === page.parent);
    if (!parent) throw new Error(`[storio-editor] Page "${page.key}" has the parent "${page.parent}", which is not a page.`);
    if (parent.parent) {
      throw new Error(`[storio-editor] Page "${page.key}": its parent "${parent.key}" has a parent itself. Use one level only.`);
    }
    if (!page.collection) {
      throw new Error(`[storio-editor] Page "${page.key}" has a parent, so it must show records: add collection: "<key>".`);
    }
  }
  return config;
}

export function findPage(config: Pick<CmsConfig, 'pages'>, pageKey: string): PageDef | undefined {
  return config.pages.find((p) => p.key === pageKey);
}
