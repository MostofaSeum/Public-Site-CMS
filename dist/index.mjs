import {
  CMS_MESSAGE,
  EDIT_MODE_PARAM,
  PREVIEW_PARAM,
  defineCms,
  findPage,
  getSectionDetail,
  getSectionKeys,
  isCmsMessage,
  isValidKey,
  listManagedSections,
  listenForCmsMessages,
  mergePageContent,
  originOf,
  postCmsMessage,
  trustedOrigins
} from "./chunk-7MTQVADH.mjs";

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
export {
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
};
