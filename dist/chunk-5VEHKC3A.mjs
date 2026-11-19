// src/core/defineCms.ts
var KEY_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
function isValidKey(key) {
  return KEY_PATTERN.test(key);
}
function defineCms(config) {
  const seen = /* @__PURE__ */ new Set();
  for (const page of config.pages) {
    if (!isValidKey(page.key)) {
      throw new Error(`[storio-editor] Invalid page key "${page.key}". Use letters, digits, "_" or "-".`);
    }
    if (seen.has(page.key)) {
      throw new Error(`[storio-editor] Duplicate page key "${page.key}".`);
    }
    seen.add(page.key);
    if (!page.route.startsWith("/")) {
      throw new Error(`[storio-editor] Page "${page.key}" route must start with "/".`);
    }
    const sectionKeys = /* @__PURE__ */ new Set();
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
  return config;
}
function findPage(config, pageKey) {
  return config.pages.find((p) => p.key === pageKey);
}

// src/core/merge.ts
function clone(value) {
  if (value === null || typeof value !== "object") return value;
  return JSON.parse(JSON.stringify(value));
}
function mergePageContent(page, records, options = {}) {
  const result = clone(page.defaults);
  for (const record of records) {
    if (record.page !== page.key) continue;
    if (!options.includeDrafts && !record.isPublished) continue;
    if (record.content !== null && record.content !== void 0) {
      result[record.sectionKey] = clone(record.content);
    }
  }
  return result;
}
function getSectionKeys(page) {
  const keys = Object.keys(page.defaults);
  for (const section of page.sections) {
    if (!keys.includes(section.key)) keys.push(section.key);
  }
  return keys;
}
function listManagedSections(pages, records) {
  const byKey = /* @__PURE__ */ new Map();
  for (const record of records) byKey.set(`${record.page}\0${record.sectionKey}`, record);
  const list = [];
  for (const page of pages) {
    for (const sectionKey of getSectionKeys(page)) {
      const record = byKey.get(`${page.key}\0${sectionKey}`);
      list.push({
        page: page.key,
        sectionKey,
        hasCustomOverride: Boolean(record),
        isPublished: record ? record.isPublished : true,
        updatedAt: record ? record.updatedAt : null,
        updatedBy: record?.updatedBy ?? null
      });
    }
  }
  return list;
}
function getSectionDetail(page, sectionKey, record) {
  const hasDefault = Object.prototype.hasOwnProperty.call(page.defaults, sectionKey);
  const declared = page.sections.some((s) => s.key === sectionKey);
  if (!record && !hasDefault && !declared) return null;
  const content = record && record.content !== null && record.content !== void 0 ? record.content : page.defaults[sectionKey] ?? {};
  return {
    page: page.key,
    sectionKey,
    content: clone(content),
    hasCustomOverride: Boolean(record),
    isPublished: record ? record.isPublished : true,
    updatedAt: record ? record.updatedAt : null,
    updatedBy: record?.updatedBy ?? null
  };
}

// src/core/messages.ts
var CMS_MESSAGE = {
  /** iframe -> studio: a section's or a single field's edit button was clicked. */
  EDIT_SECTION: "CMS_EDIT_SECTION",
  /** studio -> iframe: scroll to and highlight a section. */
  SCROLL_TO_SECTION: "SCROLL_TO_SECTION",
  /** studio -> iframe: show or hide the edit affordances. */
  SET_EDIT_MODE: "SET_CMS_EDIT_MODE",
  /** studio -> iframe: unsaved form content to render immediately. */
  DRAFT_PREVIEW: "CMS_DRAFT_PREVIEW",
  /** studio -> iframe: content was saved or reset, fetch it again. */
  CONTENT_UPDATED: "CMS_CONTENT_UPDATED"
};
var PREVIEW_PARAM = "cms_preview";
var EDIT_MODE_PARAM = "cms_edit_mode";
var MESSAGE_TYPES = new Set(Object.values(CMS_MESSAGE));
function isCmsMessage(data) {
  return typeof data === "object" && data !== null && typeof data.type === "string" && MESSAGE_TYPES.has(data.type);
}
function originOf(url, base) {
  if (!url) return null;
  try {
    return new URL(url, base).origin;
  } catch {
    return null;
  }
}
function trustedOrigins(extra = []) {
  const set = /* @__PURE__ */ new Set();
  if (typeof window !== "undefined") set.add(window.location.origin);
  for (const value of extra) {
    const origin = originOf(value ?? void 0);
    if (origin) set.add(origin);
  }
  return Array.from(set);
}
function postCmsMessage(target, message, origins) {
  if (!target) return;
  const payload = JSON.parse(JSON.stringify(message));
  for (const origin of origins) {
    try {
      target.postMessage(payload, origin);
    } catch {
    }
  }
}
function listenForCmsMessages(handler, options) {
  if (typeof window === "undefined") return () => void 0;
  const listener = (event) => {
    if (!options.origins.includes(event.origin)) return;
    if (options.source) {
      const expected = options.source();
      if (expected && event.source !== expected) return;
    }
    if (!isCmsMessage(event.data)) return;
    handler(event.data, event);
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}

export {
  isValidKey,
  defineCms,
  findPage,
  mergePageContent,
  getSectionKeys,
  listManagedSections,
  getSectionDetail,
  CMS_MESSAGE,
  PREVIEW_PARAM,
  EDIT_MODE_PARAM,
  isCmsMessage,
  originOf,
  trustedOrigins,
  postCmsMessage,
  listenForCmsMessages
};
