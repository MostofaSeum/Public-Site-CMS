"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  CMS_MESSAGE: () => CMS_MESSAGE,
  EDIT_MODE_PARAM: () => EDIT_MODE_PARAM,
  PREVIEW_PARAM: () => PREVIEW_PARAM,
  buildPreviewUrl: () => buildPreviewUrl,
  defineCms: () => defineCms,
  fillRoute: () => fillRoute,
  findPage: () => findPage,
  getSectionDetail: () => getSectionDetail,
  getSectionKeys: () => getSectionKeys,
  groupPageOf: () => groupPageOf,
  isCmsMessage: () => isCmsMessage,
  isDynamicRoute: () => isDynamicRoute,
  isValidKey: () => isValidKey,
  listManagedSections: () => listManagedSections,
  listenForCmsMessages: () => listenForCmsMessages,
  mergePageContent: () => mergePageContent,
  originOf: () => originOf,
  postCmsMessage: () => postCmsMessage,
  publicUrl: () => publicUrl,
  recordPagesOf: () => recordPagesOf,
  topLevelPages: () => topLevelPages,
  trustedOrigins: () => trustedOrigins
});
module.exports = __toCommonJS(src_exports);

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
    if (page.collection !== void 0 && !isValidKey(page.collection)) {
      throw new Error(`[storio-editor] Invalid collection "${page.collection}" on page "${page.key}".`);
    }
    if (/\[[^\]]+\]/.test(page.route) && !page.collection) {
      throw new Error(
        `[storio-editor] Page "${page.key}" has the route "${page.route}", which shows one record at a time. Add collection: "<key>" so the studio can list the records.`
      );
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
  /** iframe -> studio: a section's, a single field's or a record field's edit button was clicked. */
  EDIT_SECTION: "CMS_EDIT_SECTION",
  /** studio -> iframe: scroll to and highlight a section. */
  SCROLL_TO_SECTION: "SCROLL_TO_SECTION",
  /** studio -> iframe: show or hide the edit affordances. */
  SET_EDIT_MODE: "SET_CMS_EDIT_MODE",
  /** studio -> iframe: unsaved form content to render immediately. */
  DRAFT_PREVIEW: "CMS_DRAFT_PREVIEW",
  /** studio -> iframe: content was saved or reset, fetch it again. */
  CONTENT_UPDATED: "CMS_CONTENT_UPDATED",
  /** studio -> iframe: unsaved values of a collection record, to render immediately. */
  ITEM_DRAFT: "CMS_ITEM_DRAFT"
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

// src/core/paths.ts
function publicUrl(route, publicSiteUrl) {
  if (!publicSiteUrl) return route;
  return `${publicSiteUrl.replace(/\/+$/, "")}${route.startsWith("/") ? route : `/${route}`}`;
}
function buildPreviewUrl(route, options = {}) {
  const base = publicUrl(route, options.publicSiteUrl);
  const params = [`${PREVIEW_PARAM}=1`];
  if (options.editMode) params.push(`${EDIT_MODE_PARAM}=1`);
  if (options.cacheBust !== void 0) params.push(`t=${encodeURIComponent(String(options.cacheBust))}`);
  return `${base}${base.includes("?") ? "&" : "?"}${params.join("&")}`;
}

// src/core/collections.ts
var BRACKET = /\[(?:\.\.\.)?([A-Za-z0-9_]+)\]/g;
function isDynamicRoute(route) {
  return /\[[^\]]+\]/.test(route);
}
function fillRoute(route, item) {
  return route.replace(BRACKET, (_, name) => encodeURIComponent(item.params?.[name] ?? item.id));
}
function topLevelPages(config) {
  return config.pages.filter((p) => !p.parent);
}
function groupPageOf(config, page) {
  return page.parent && config.pages.find((p) => p.key === page.parent) || page;
}
function recordPagesOf(config, group) {
  const children = config.pages.filter((p) => p.parent === group.key && p.collection);
  return group.collection ? [group, ...children] : children;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CMS_MESSAGE,
  EDIT_MODE_PARAM,
  PREVIEW_PARAM,
  buildPreviewUrl,
  defineCms,
  fillRoute,
  findPage,
  getSectionDetail,
  getSectionKeys,
  groupPageOf,
  isCmsMessage,
  isDynamicRoute,
  isValidKey,
  listManagedSections,
  listenForCmsMessages,
  mergePageContent,
  originOf,
  postCmsMessage,
  publicUrl,
  recordPagesOf,
  topLevelPages,
  trustedOrigins
});
