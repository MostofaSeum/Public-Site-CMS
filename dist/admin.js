"use client";
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/admin/index.ts
var admin_exports = {};
__export(admin_exports, {
  CmsAuthGate: () => CmsAuthGate,
  CmsLogin: () => CmsLogin,
  CmsLogoutButton: () => CmsLogoutButton,
  CmsNavButton: () => CmsNavButton,
  CmsStudio: () => CmsStudio,
  POPULAR_ICONS: () => POPULAR_ICONS,
  getDynamicIcon: () => getDynamicIcon,
  safeNext: () => safeNext
});
module.exports = __toCommonJS(admin_exports);

// src/admin/CmsStudio.tsx
var import_react9 = require("react");
var import_react_hot_toast6 = require("react-hot-toast");
var import_lucide_react8 = require("lucide-react");

// src/core/defineCms.ts
function findPage(config, pageKey) {
  return config.pages.find((p) => p.key === pageKey);
}

// src/admin/StudioContext.tsx
var import_react = require("react");

// src/core/messages.ts
var CMS_MESSAGE = {
  /** iframe -> studio: a section's edit button was clicked. */
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

// src/admin/StudioContext.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var StudioContext = (0, import_react.createContext)(null);
var StudioProvider = ({ config, children }) => {
  const [origins, setOrigins] = (0, import_react.useState)([]);
  (0, import_react.useEffect)(() => {
    const extra = [...config.allowedOrigins ?? []];
    const siteOrigin = originOf(config.publicSiteUrl);
    if (siteOrigin) extra.push(siteOrigin);
    setOrigins(trustedOrigins(extra));
  }, [config.allowedOrigins, config.publicSiteUrl]);
  const value = (0, import_react.useMemo)(() => ({ config, origins }), [config, origins]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StudioContext.Provider, { value, children });
};
function useStudio() {
  const ctx = (0, import_react.useContext)(StudioContext);
  if (!ctx) throw new Error("[visual-cms] Studio components must be rendered inside <CmsStudio>.");
  return ctx;
}

// src/admin/CanvasEditor.tsx
var import_react7 = __toESM(require("react"));
var import_lucide_react6 = require("lucide-react");
var import_react_hot_toast4 = __toESM(require("react-hot-toast"));

// src/core/merge.ts
function clone(value) {
  if (value === null || typeof value !== "object") return value;
  return JSON.parse(JSON.stringify(value));
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

// src/admin/SectionEditorForm.tsx
var import_react6 = require("react");
var import_lucide_react5 = require("lucide-react");
var import_react_hot_toast3 = __toESM(require("react-hot-toast"));

// src/admin/JsonInspectorModal.tsx
var import_react2 = require("react");
var import_lucide_react = require("lucide-react");
var import_react_hot_toast = __toESM(require("react-hot-toast"));
var import_jsx_runtime2 = require("react/jsx-runtime");
var JsonInspectorModal = ({
  isOpen,
  onClose,
  sectionTitle,
  jsonData,
  onApply
}) => {
  const [text, setText] = (0, import_react2.useState)("");
  const [error, setError] = (0, import_react2.useState)(null);
  const [copied, setCopied] = (0, import_react2.useState)(false);
  (0, import_react2.useEffect)(() => {
    if (jsonData !== void 0) {
      setText(JSON.stringify(jsonData, null, 2));
      setError(null);
    }
  }, [jsonData, isOpen]);
  if (!isOpen) return null;
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    import_react_hot_toast.default.success("Copied JSON to clipboard");
    setTimeout(() => setCopied(false), 2e3);
  };
  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);
    try {
      JSON.parse(val);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON");
    }
  };
  const handleApply = () => {
    try {
      const parsed = JSON.parse(text);
      onApply(parsed);
      import_react_hot_toast.default.success("Applied JSON edits to form");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON format");
      import_react_hot_toast.default.error("Please fix JSON syntax errors before applying");
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "w-full max-w-4xl max-h-[90vh] flex flex-col bg-slate-900 border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden text-white", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "p-4 border-b border-purple-500/20 flex items-center justify-between bg-slate-800/80", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("h3", { className: "text-lg font-bold text-white flex items-center gap-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "Raw JSON Inspector:" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-purple-400 font-mono text-sm", children: sectionTitle })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "text-xs text-slate-400", children: "Direct JSON editing for power users. Changes are validated before applying." })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "button",
          {
            onClick: handleCopy,
            className: "flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-slate-200 transition-colors border border-slate-600",
            children: [
              copied ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react.Check, { className: "w-3.5 h-3.5 text-emerald-400" }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react.Copy, { className: "w-3.5 h-3.5" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: copied ? "Copied" : "Copy" })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "button",
          {
            onClick: onClose,
            className: "p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors",
            children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react.X, { className: "w-5 h-5" })
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex-1 p-4 overflow-hidden flex flex-col", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "textarea",
        {
          value: text,
          onChange: handleTextChange,
          spellCheck: false,
          className: "w-full flex-1 min-h-[400px] font-mono text-xs p-4 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 resize-none"
        }
      ),
      error && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "mt-2 flex items-center gap-2 text-rose-400 text-xs bg-rose-950/40 border border-rose-800/50 p-2.5 rounded-lg", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react.AlertCircle, { className: "w-4 h-4 shrink-0" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "font-mono", children: error })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "p-4 border-t border-purple-500/20 bg-slate-800/80 flex items-center justify-between", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-xs text-slate-400", children: error ? "Fix errors to apply" : "Syntax valid" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "button",
          {
            onClick: onClose,
            className: "px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 transition-colors",
            children: "Cancel"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "button",
          {
            onClick: handleApply,
            disabled: error !== null,
            className: `px-5 py-2 rounded-xl text-xs font-semibold shadow-lg transition-all ${error !== null ? "bg-slate-700 text-slate-500 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30"}`,
            children: "Apply to Form"
          }
        )
      ] })
    ] })
  ] }) });
};

// src/admin/LivePreviewModal.tsx
var import_react3 = require("react");
var import_lucide_react2 = require("lucide-react");
var import_jsx_runtime3 = require("react/jsx-runtime");
var LivePreviewModal = ({
  isOpen,
  onClose,
  pagePath
}) => {
  const [device, setDevice] = (0, import_react3.useState)("desktop");
  const [iframeKey, setIframeKey] = (0, import_react3.useState)(0);
  const { config } = useStudio();
  if (!isOpen) return null;
  const getDeviceWidth = () => {
    switch (device) {
      case "mobile":
        return "w-[375px] h-[667px]";
      case "tablet":
        return "w-[768px] h-[1024px]";
      default:
        return "w-full h-full";
    }
  };
  const handleRefresh = () => {
    setIframeKey((prev) => prev + 1);
  };
  const getPublicLiveUrl = (route) => publicUrl(route, config.publicSiteUrl);
  const iframeSrc = buildPreviewUrl(pagePath, { publicSiteUrl: config.publicSiteUrl, cacheBust: iframeKey });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-md animate-fadeIn", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "h-14 border-b border-purple-500/20 bg-slate-900/90 px-4 flex items-center justify-between text-white", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "font-semibold text-sm sm:text-base text-purple-300", children: [
          "Live Preview: ",
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("code", { className: "text-white bg-slate-800 px-2 py-0.5 rounded", children: pagePath })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
          "a",
          {
            href: getPublicLiveUrl(pagePath),
            target: "_blank",
            rel: "noopener noreferrer",
            className: "flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors bg-slate-800/80 px-2 py-1 rounded border border-slate-700",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: "Open in Tab" }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_lucide_react2.ExternalLink, { className: "w-3 h-3" })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700/60", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
          "button",
          {
            onClick: () => setDevice("desktop"),
            className: `p-1.5 rounded transition-all flex items-center gap-1 text-xs font-medium ${device === "desktop" ? "bg-purple-600 text-white shadow-sm" : "text-slate-400 hover:text-white hover:bg-slate-700"}`,
            title: "Desktop view",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_lucide_react2.Monitor, { className: "w-4 h-4" }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "hidden sm:inline", children: "Desktop" })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
          "button",
          {
            onClick: () => setDevice("tablet"),
            className: `p-1.5 rounded transition-all flex items-center gap-1 text-xs font-medium ${device === "tablet" ? "bg-purple-600 text-white shadow-sm" : "text-slate-400 hover:text-white hover:bg-slate-700"}`,
            title: "Tablet view (768px)",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_lucide_react2.Tablet, { className: "w-4 h-4" }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "hidden sm:inline", children: "Tablet" })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
          "button",
          {
            onClick: () => setDevice("mobile"),
            className: `p-1.5 rounded transition-all flex items-center gap-1 text-xs font-medium ${device === "mobile" ? "bg-purple-600 text-white shadow-sm" : "text-slate-400 hover:text-white hover:bg-slate-700"}`,
            title: "Mobile view (375px)",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_lucide_react2.Smartphone, { className: "w-4 h-4" }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "hidden sm:inline", children: "Mobile" })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "button",
          {
            onClick: handleRefresh,
            className: "p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700",
            title: "Refresh preview",
            children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_lucide_react2.RefreshCw, { className: "w-4 h-4" })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "button",
          {
            onClick: onClose,
            className: "p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors",
            title: "Close preview",
            children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_lucide_react2.X, { className: "w-5 h-5" })
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        className: `transition-all duration-300 shadow-2xl rounded-xl overflow-hidden border border-purple-500/30 bg-white ${getDeviceWidth()}`,
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "iframe",
          {
            src: iframeSrc,
            title: "Live Preview",
            className: "w-full h-full border-0"
          },
          iframeKey
        )
      }
    ) })
  ] });
};

// src/admin/VisualImagePicker.tsx
var import_react4 = require("react");
var import_react_dom = require("react-dom");
var import_lucide_react3 = require("lucide-react");
var import_react_hot_toast2 = __toESM(require("react-hot-toast"));
var import_jsx_runtime4 = require("react/jsx-runtime");
var VisualImagePicker = ({
  value,
  onChange,
  label,
  fieldId,
  autoOpen = false,
  onClose
}) => {
  const { config } = useStudio();
  const adapter = config.adapter;
  const presets = config.imagePresets ?? [];
  const CATEGORY_TABS = (0, import_react4.useMemo)(() => {
    const tabs = [{ id: "all", label: "All Photos" }];
    if (adapter.listMedia || adapter.uploadMedia) tabs.push({ id: "uploaded", label: "Uploaded" });
    if (config.imagePresetCategories) {
      tabs.push(...config.imagePresetCategories.filter((c) => c.id !== "all" && c.id !== "uploaded"));
    } else {
      for (const category of Array.from(new Set(presets.map((p) => p.category)))) {
        if (category !== "uploaded") tabs.push({ id: category, label: category });
      }
    }
    return tabs;
  }, [adapter, config.imagePresetCategories, presets]);
  const [isOpen, setIsOpen] = (0, import_react4.useState)(autoOpen);
  const [activeTab, setActiveTab] = (0, import_react4.useState)("presets");
  const [selectedCategory, setSelectedCategory] = (0, import_react4.useState)("all");
  const [searchQuery, setSearchQuery] = (0, import_react4.useState)("");
  const [selectedPhoto, setSelectedPhoto] = (0, import_react4.useState)(value || "");
  const [customUrlInput, setCustomUrlInput] = (0, import_react4.useState)("");
  const [isUploading, setIsUploading] = (0, import_react4.useState)(false);
  const [backendMedia, setBackendMedia] = (0, import_react4.useState)([]);
  const [isLoadingBackendMedia, setIsLoadingBackendMedia] = (0, import_react4.useState)(false);
  const [mounted, setMounted] = (0, import_react4.useState)(false);
  const fileInputRef = (0, import_react4.useRef)(null);
  (0, import_react4.useEffect)(() => {
    setMounted(true);
  }, []);
  (0, import_react4.useEffect)(() => {
    if (isOpen) {
      setSelectedPhoto(value || "");
      setCustomUrlInput(value?.startsWith("http") ? value : "");
      fetchBackendMedia();
    }
  }, [isOpen, value]);
  const fetchBackendMedia = async () => {
    if (!adapter.listMedia) return;
    try {
      setIsLoadingBackendMedia(true);
      const res = await adapter.listMedia();
      setBackendMedia(
        res.filter((item) => item.url).map((item) => ({
          url: item.url,
          title: item.name || "Uploaded Image",
          category: "uploaded",
          tag: "Uploaded"
        }))
      );
    } catch {
    } finally {
      setIsLoadingBackendMedia(false);
    }
  };
  const allAvailablePhotos = (0, import_react4.useMemo)(() => {
    const combined = [...backendMedia, ...presets];
    const seen = /* @__PURE__ */ new Set();
    return combined.filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });
  }, [backendMedia, presets]);
  const filteredPhotos = (0, import_react4.useMemo)(() => {
    return allAvailablePhotos.filter((item) => {
      const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
      const matchesSearch = searchQuery.trim() === "" || item.title.toLowerCase().includes(searchQuery.toLowerCase()) || item.url.toLowerCase().includes(searchQuery.toLowerCase()) || item.tag && item.tag.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [allAvailablePhotos, selectedCategory, searchQuery]);
  const handleFilesUpload = async (files) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (fileArray.length === 0) {
      import_react_hot_toast2.default.error("Please upload image files (PNG, JPG, SVG, WebP, GIF)");
      return;
    }
    try {
      setIsUploading(true);
      if (!adapter.uploadMedia) {
        throw new Error("Storage adapter has no uploadMedia");
      }
      const items = await adapter.uploadMedia(fileArray);
      if (items.length > 0) {
        const newUploadedItems = items.map((it) => ({
          url: it.url,
          title: it.name,
          category: "uploaded",
          tag: "Uploaded"
        }));
        setBackendMedia((prev) => [...newUploadedItems, ...prev]);
        setSelectedPhoto(items[0].url);
        import_react_hot_toast2.default.success(`Successfully uploaded ${items.length} image(s)!`);
        return;
      }
    } catch {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (result) {
          setSelectedPhoto(result);
          import_react_hot_toast2.default.success("Image loaded locally!");
        }
      };
      reader.readAsDataURL(fileArray[0]);
    } finally {
      setIsUploading(false);
    }
  };
  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    import_react_hot_toast2.default.success("Image path copied to clipboard");
  };
  const closeModal = () => {
    setIsOpen(false);
    if (onClose) onClose();
  };
  const handleApply = () => {
    const finalUrl = activeTab === "url" ? customUrlInput.trim() : selectedPhoto;
    onChange(finalUrl);
    closeModal();
    import_react_hot_toast2.default.success("Image updated!");
  };
  const handleClear = () => {
    onChange("");
    setSelectedPhoto("");
    import_react_hot_toast2.default.success("Image removed");
  };
  const modalContent = isOpen ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "div",
    {
      className: "fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200",
      onClick: () => setIsOpen(false),
      children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
        "div",
        {
          className: "w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-purple-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100",
          onClick: (e) => e.stopPropagation(),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex items-center gap-3", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_lucide_react3.Image, { className: "w-5 h-5" }) }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("h3", { className: "text-base font-bold text-white flex items-center gap-2", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: "Visual Image Selector" }),
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "text-[11px] font-normal px-2 py-0.5 rounded-full bg-purple-900/40 text-purple-300 border border-purple-700/40", children: "SaaS CMS Studio" })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { className: "text-xs text-slate-400", children: [
                    "Preview, search, and click to select any photo or logo for",
                    " ",
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "text-purple-300 font-mono", children: label || fieldId || "this field" })
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "button",
                {
                  type: "button",
                  onClick: closeModal,
                  className: "p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors",
                  children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_lucide_react3.X, { className: "w-5 h-5" })
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "px-6 pt-3 pb-2 border-b border-slate-800/80 bg-slate-950/40 flex items-center gap-2 shrink-0", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
                "button",
                {
                  type: "button",
                  onClick: () => setActiveTab("presets"),
                  className: `flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === "presets" ? "bg-purple-600 text-white shadow-md shadow-purple-900/40" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"}`,
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_lucide_react3.FolderOpen, { className: "w-4 h-4" }),
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: "Media Library & Presets" }),
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "text-[10px] px-1.5 py-0.2 rounded-full bg-purple-950 text-purple-200", children: allAvailablePhotos.length })
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
                "button",
                {
                  type: "button",
                  onClick: () => setActiveTab("upload"),
                  className: `flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === "upload" ? "bg-purple-600 text-white shadow-md shadow-purple-900/40" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"}`,
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_lucide_react3.UploadCloud, { className: "w-4 h-4" }),
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: "Upload From Computer" })
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
                "button",
                {
                  type: "button",
                  onClick: () => setActiveTab("url"),
                  className: `flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === "url" ? "bg-purple-600 text-white shadow-md shadow-purple-900/40" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"}`,
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_lucide_react3.ExternalLink, { className: "w-4 h-4" }),
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: "External URL" })
                  ]
                }
              )
            ] }),
            activeTab === "presets" && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex-1 overflow-hidden flex flex-col p-6 space-y-4", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "relative flex-1", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_lucide_react3.Search, { className: "w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" }),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                    "input",
                    {
                      type: "text",
                      placeholder: "Search photo by name or tag (e.g. logo, teacher, slider, template)...",
                      value: searchQuery,
                      onChange: (e) => setSearchQuery(e.target.value),
                      className: "w-full text-xs pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-750 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    }
                  ),
                  searchQuery && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                    "button",
                    {
                      type: "button",
                      onClick: () => setSearchQuery(""),
                      className: "absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300",
                      children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_lucide_react3.X, { className: "w-3.5 h-3.5" })
                    }
                  )
                ] }),
                isLoadingBackendMedia && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex items-center gap-1.5 text-xs text-purple-400 shrink-0", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_lucide_react3.Loader2, { className: "w-3.5 h-3.5 animate-spin" }),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: "Syncing media..." })
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar shrink-0", children: CATEGORY_TABS.map((tab) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "button",
                {
                  type: "button",
                  onClick: () => setSelectedCategory(tab.id),
                  className: `text-xs px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-all ${selectedCategory === tab.id ? "bg-purple-900/60 text-purple-200 border border-purple-500/50" : "bg-slate-950/50 text-slate-400 hover:text-slate-200 border border-slate-800"}`,
                  children: tab.label
                },
                tab.id
              )) }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "flex-1 overflow-y-auto pr-1 custom-scrollbar", children: filteredPhotos.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-2xl", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_lucide_react3.Image, { className: "w-10 h-10 text-slate-600 mb-2" }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "text-sm font-semibold text-slate-300", children: "No photos match your filter" }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "text-xs text-slate-500 mt-1", children: "Try searching for another keyword or switch category." })
              ] }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5 pb-2", children: filteredPhotos.map((photo) => {
                const isSelected = selectedPhoto === photo.url;
                return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
                  "div",
                  {
                    onClick: () => setSelectedPhoto(photo.url),
                    onDoubleClick: () => {
                      setSelectedPhoto(photo.url);
                      onChange(photo.url);
                      setIsOpen(false);
                      import_react_hot_toast2.default.success("Image selected!");
                    },
                    className: `group relative rounded-xl border p-2 flex flex-col cursor-pointer transition-all ${isSelected ? "bg-purple-950/40 border-purple-500 ring-2 ring-purple-500/50 shadow-lg shadow-purple-950/50" : "bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950/90"}`,
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "relative w-full aspect-video rounded-lg bg-slate-900/90 border border-slate-800/80 flex items-center justify-center overflow-hidden mb-2", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                          "img",
                          {
                            src: photo.url,
                            alt: photo.title,
                            className: "w-full h-full object-contain p-1.5 transition-transform duration-200 group-hover:scale-105",
                            onError: (e) => {
                              e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="gray" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
                            }
                          }
                        ),
                        isSelected && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-md", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_lucide_react3.Check, { className: "w-3.5 h-3.5 stroke-[3]" }) })
                      ] }),
                      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "min-w-0", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "text-xs font-semibold text-slate-200 truncate group-hover:text-purple-300 transition-colors", children: photo.title }),
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex items-center justify-between mt-1", children: [
                          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "text-[10px] font-mono text-slate-400 truncate max-w-[120px]", children: photo.url }),
                          photo.tag && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-medium", children: photo.tag })
                        ] })
                      ] })
                    ]
                  },
                  photo.url
                );
              }) }) })
            ] }),
            activeTab === "upload" && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex-1 p-8 flex flex-col items-center justify-center", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "input",
                {
                  ref: fileInputRef,
                  type: "file",
                  accept: "image/*",
                  multiple: true,
                  className: "hidden",
                  onChange: (e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) handleFilesUpload(files);
                  }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
                "div",
                {
                  onClick: () => fileInputRef.current?.click(),
                  onDragOver: (e) => e.preventDefault(),
                  onDrop: (e) => {
                    e.preventDefault();
                    const files = e.dataTransfer.files;
                    if (files && files.length > 0) handleFilesUpload(files);
                  },
                  className: "w-full max-w-lg p-10 border-2 border-dashed border-slate-700 hover:border-purple-500 rounded-3xl bg-slate-950/50 hover:bg-purple-950/10 flex flex-col items-center justify-center text-center cursor-pointer transition-all group",
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-110 transition-transform", children: isUploading ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_lucide_react3.Loader2, { className: "w-8 h-8 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_lucide_react3.UploadCloud, { className: "w-8 h-8" }) }),
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h4", { className: "text-sm font-bold text-white mb-1", children: isUploading ? "Uploading Images..." : "Click or Drag & Drop Multiple Photos Here" }),
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "text-xs text-slate-400 max-w-xs mb-4", children: "Supports single or multiple uploads (PNG, JPG, WebP, SVG, GIF). All uploaded photos appear in your Media Library." }),
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "px-4 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 text-xs font-semibold transition-colors", children: "Browse from Computer (Select Multiple)" })
                  ]
                }
              ),
              selectedPhoto && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "mt-6 flex items-center gap-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "text-xs text-slate-400", children: "Selected photo:" }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "text-xs font-mono text-purple-300 truncate max-w-md", children: selectedPhoto })
              ] })
            ] }),
            activeTab === "url" && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex-1 p-8 max-w-xl mx-auto w-full flex flex-col justify-center space-y-5", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "space-y-2", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("label", { className: "text-xs font-semibold text-slate-300", children: "External Image URL (CDN / Cloudinary / S3 / Web)" }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                  "input",
                  {
                    type: "url",
                    placeholder: "https://example.com/images/my-photo.jpg",
                    value: customUrlInput,
                    onChange: (e) => setCustomUrlInput(e.target.value),
                    className: "w-full text-xs p-3.5 rounded-xl bg-slate-950/80 border border-slate-750 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "text-[11px] text-slate-400", children: "Paste any public image link. Make sure the link is publicly accessible via HTTPS." })
              ] }),
              customUrlInput && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "text-xs font-semibold text-slate-300", children: "Live Preview:" }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "w-full h-40 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                  "img",
                  {
                    src: customUrlInput,
                    alt: "URL Preview",
                    className: "w-full h-full object-contain p-2",
                    onError: (e) => {
                      e.currentTarget.alt = "Invalid or unreachable image URL";
                    }
                  }
                ) })
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex items-center gap-2 min-w-0", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "text-xs text-slate-400", children: "Selected:" }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "text-xs font-mono text-purple-300 truncate max-w-[280px]", children: activeTab === "url" ? customUrlInput || "None" : selectedPhoto || "None" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                  "button",
                  {
                    type: "button",
                    onClick: () => setIsOpen(false),
                    className: "px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors",
                    children: "Cancel"
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
                  "button",
                  {
                    type: "button",
                    onClick: handleApply,
                    disabled: activeTab === "url" ? !customUrlInput.trim() : !selectedPhoto,
                    className: "flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white text-xs font-semibold transition-all shadow-md shadow-purple-900/30",
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_lucide_react3.Check, { className: "w-4 h-4" }),
                      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: "Confirm & Use Image" })
                    ]
                  }
                )
              ] })
            ] })
          ]
        }
      )
    }
  ) : null;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "space-y-1.5 w-full", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { className: "text-xs font-semibold text-slate-300 capitalize flex items-center gap-1.5", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_lucide_react3.Image, { className: "w-3.5 h-3.5 text-purple-400" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: label?.replace(/([A-Z])/g, " $1") || "Image" })
      ] }),
      fieldId && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "text-[10px] font-mono text-slate-500", children: fieldId })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "p-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 flex items-center justify-between gap-3 w-full", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
        "div",
        {
          onClick: () => setIsOpen(true),
          className: "flex items-center gap-3 min-w-0 flex-1 cursor-pointer group",
          title: "Click to change image",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "w-10 h-10 rounded-lg bg-purple-950/60 border border-purple-800/50 flex items-center justify-center overflow-hidden shrink-0 shadow-inner group-hover:border-purple-500 transition-colors", children: value ? (
              // eslint-disable-next-line @next/next/no-img-element
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "img",
                {
                  src: value,
                  alt: label || "Thumbnail",
                  className: "w-full h-full object-contain p-1",
                  onError: (e) => {
                    e.currentTarget.style.display = "none";
                  }
                }
              )
            ) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_lucide_react3.Image, { className: "w-5 h-5 text-purple-400/70" }) }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "min-w-0 flex-1", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: `text-xs font-semibold font-mono truncate ${value ? "text-white" : "text-slate-500 italic"}`, children: value || "No image selected" }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "text-[10px] text-slate-400 truncate", children: value ? "Click to replace or preview" : "Click to select from media presets" })
            ] })
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex items-center gap-1.5 shrink-0", children: [
        value && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "button",
            {
              type: "button",
              onClick: () => handleCopy(value),
              className: "p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors",
              title: "Copy Image Path",
              children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_lucide_react3.Copy, { className: "w-3.5 h-3.5" })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "button",
            {
              type: "button",
              onClick: handleClear,
              className: "p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors",
              title: "Remove Image",
              children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_lucide_react3.Trash2, { className: "w-3.5 h-3.5" })
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "button",
          {
            type: "button",
            onClick: () => setIsOpen(true),
            className: "px-3 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 text-xs font-semibold transition-all shrink-0",
            children: value ? "Change Image" : "Select Image"
          }
        )
      ] })
    ] }),
    mounted && typeof document !== "undefined" && modalContent && (0, import_react_dom.createPortal)(modalContent, document.body)
  ] });
};

// src/admin/VisualIconPicker.tsx
var import_react5 = require("react");
var import_react_dom2 = require("react-dom");
var import_lucide_react4 = require("lucide-react");

// src/admin/dynamicIcon.tsx
var LucideIcons = __toESM(require("lucide-react"));
function getDynamicIcon(iconName, fallback = LucideIcons.Circle) {
  if (!iconName || typeof iconName !== "string") return fallback;
  const cleanName = iconName.trim();
  const pascalName = cleanName.split(/[-_\s]+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("");
  const Resolved = LucideIcons[cleanName] || LucideIcons[pascalName];
  if (Resolved && typeof Resolved === "object") {
    return Resolved;
  }
  const lowerLookup = Object.keys(LucideIcons).find(
    (k) => k.toLowerCase() === cleanName.toLowerCase() || k.toLowerCase() === pascalName.toLowerCase()
  );
  if (lowerLookup) {
    const LowerResolved = LucideIcons[lowerLookup];
    if (LowerResolved && typeof LowerResolved === "object") {
      return LowerResolved;
    }
  }
  return fallback;
}
var POPULAR_ICONS = [
  // Education & Academics
  { name: "GraduationCap", category: "Education" },
  { name: "School", category: "Education" },
  { name: "BookOpen", category: "Education" },
  { name: "Award", category: "Education" },
  { name: "Trophy", category: "Education" },
  { name: "Medal", category: "Education" },
  { name: "FlaskConical", category: "Education" },
  { name: "Compass", category: "Education" },
  { name: "PenTool", category: "Education" },
  // System & Technology
  { name: "Zap", category: "Technology" },
  { name: "Globe", category: "Technology" },
  { name: "Globe2", category: "Technology" },
  { name: "Terminal", category: "Technology" },
  { name: "Laptop", category: "Technology" },
  { name: "Smartphone", category: "Technology" },
  { name: "Layers", category: "Technology" },
  { name: "Layout", category: "Technology" },
  { name: "LayoutDashboard", category: "Technology" },
  { name: "Cloud", category: "Technology" },
  { name: "Radio", category: "Technology" },
  { name: "Settings2", category: "Technology" },
  // Business & Institutional
  { name: "Landmark", category: "Business" },
  { name: "Building2", category: "Business" },
  { name: "Briefcase", category: "Business" },
  { name: "Users", category: "Business" },
  { name: "CreditCard", category: "Business" },
  { name: "BarChart3", category: "Business" },
  { name: "TrendingUp", category: "Business" },
  { name: "ShieldCheck", category: "Business" },
  { name: "Lock", category: "Business" },
  // Communication & Status
  { name: "Calendar", category: "Communication" },
  { name: "CalendarCheck", category: "Communication" },
  { name: "Headphones", category: "Communication" },
  { name: "Phone", category: "Communication" },
  { name: "Mail", category: "Communication" },
  { name: "MessageSquare", category: "Communication" },
  { name: "MessageCircle", category: "Communication" },
  { name: "BellRing", category: "Communication" },
  { name: "Megaphone", category: "Communication" },
  { name: "Check", category: "Communication" },
  { name: "CheckCircle2", category: "Communication" },
  { name: "ArrowRight", category: "Communication" },
  { name: "ExternalLink", category: "Communication" },
  { name: "FileText", category: "Communication" },
  { name: "FileCheck2", category: "Communication" },
  { name: "MapPin", category: "Communication" },
  // Social
  { name: "Facebook", category: "Social" },
  { name: "Twitter", category: "Social" },
  { name: "Linkedin", category: "Social" },
  { name: "Instagram", category: "Social" }
];

// src/admin/VisualIconPicker.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
var VisualIconPicker = ({
  value,
  onChange,
  label,
  fieldId
}) => {
  const [isOpen, setIsOpen] = (0, import_react5.useState)(false);
  const [search, setSearch] = (0, import_react5.useState)("");
  const [activeCategory, setActiveCategory] = (0, import_react5.useState)("all");
  const [mounted, setMounted] = (0, import_react5.useState)(false);
  (0, import_react5.useEffect)(() => {
    setMounted(true);
  }, []);
  const categories = (0, import_react5.useMemo)(() => {
    const set = new Set(POPULAR_ICONS.map((i) => i.category));
    return ["all", ...Array.from(set)];
  }, []);
  const filteredIcons = (0, import_react5.useMemo)(() => {
    return POPULAR_ICONS.filter((item) => {
      const matchCat = activeCategory === "all" || item.category === activeCategory;
      const matchSearch = !search.trim() || item.name.toLowerCase().includes(search.trim().toLowerCase());
      return matchCat && matchSearch;
    });
  }, [search, activeCategory]);
  const CurrentIcon = getDynamicIcon(value || "Sparkles");
  const modalContent = isOpen ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    "div",
    {
      className: "fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md",
      onClick: () => setIsOpen(false),
      children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
        "div",
        {
          className: "w-full max-w-xl md:max-w-2xl bg-slate-900 border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]",
          onClick: (e) => e.stopPropagation(),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex items-center gap-2.5", children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h3", { className: "text-sm font-bold text-white", children: "Choose Lucide Icon" }),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("p", { className: "text-[11px] text-slate-400", children: [
                    "Select an icon for ",
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "font-mono text-purple-300", children: label || fieldId })
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "button",
                {
                  type: "button",
                  onClick: () => setIsOpen(false),
                  className: "p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors",
                  children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react4.X, { className: "w-4 h-4" })
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "p-4 border-b border-slate-800 space-y-3 bg-slate-950/40 shrink-0", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "relative", children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react4.Search, { className: "w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "input",
                  {
                    type: "text",
                    placeholder: "Search icons (e.g. graduation, star, check, globe, book)...",
                    value: search,
                    onChange: (e) => setSearch(e.target.value),
                    className: "w-full text-xs pl-9 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  }
                )
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5", children: categories.map((cat) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "button",
                {
                  type: "button",
                  onClick: () => setActiveCategory(cat),
                  className: `text-xs px-3 py-1.5 rounded-lg font-medium whitespace-nowrap capitalize transition-all ${activeCategory === cat ? "bg-purple-600 text-white shadow-sm" : "bg-slate-950/70 text-slate-400 hover:text-white border border-slate-800"}`,
                  children: cat
                },
                cat
              )) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "p-4 overflow-y-auto max-h-[55vh] custom-scrollbar", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3", children: filteredIcons.map((item) => {
                const IconComp = getDynamicIcon(item.name);
                const isSelected = (value || "").toLowerCase() === item.name.toLowerCase();
                return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                  "button",
                  {
                    type: "button",
                    onClick: () => {
                      onChange(item.name);
                      setIsOpen(false);
                    },
                    className: `flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all group min-h-[90px] ${isSelected ? "bg-purple-950/60 border-purple-500 ring-2 ring-purple-500/50 shadow-md" : "bg-slate-950/60 border-slate-800 hover:bg-slate-800/70 hover:border-slate-700"}`,
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "w-8 h-8 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform text-slate-300 group-hover:text-purple-300 shrink-0", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(IconComp, { className: "w-5 h-5" }) }),
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "text-xs font-mono text-slate-300 truncate w-full px-1", children: item.name }),
                      isSelected && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mt-1 flex items-center gap-1 text-[10px] text-emerald-400 font-semibold", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react4.Check, { className: "w-3 h-3" }),
                        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "Active" })
                      ] })
                    ]
                  },
                  item.name
                );
              }) }),
              filteredIcons.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "p-8 text-center text-xs text-slate-500", children: [
                'No icons found matching "',
                search,
                '". Try another search term.'
              ] })
            ] })
          ]
        }
      )
    }
  ) : null;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "space-y-1.5 w-full", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("label", { className: "text-xs font-semibold text-slate-300 capitalize flex items-center gap-1.5", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: label?.replace(/([A-Z])/g, " $1") || "Icon" }) }),
      fieldId && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "text-[10px] font-mono text-slate-500", children: fieldId })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "p-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 flex items-center justify-between gap-3 w-full", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex items-center gap-3 min-w-0", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "w-9 h-9 rounded-lg bg-purple-950/60 border border-purple-800/50 flex items-center justify-center text-purple-300 shrink-0 shadow-inner", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CurrentIcon, { className: "w-5 h-5" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "min-w-0", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "text-xs font-semibold text-white font-mono truncate", children: value || "None selected" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "text-[10px] text-slate-400 truncate", children: "Lucide icon" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "button",
        {
          type: "button",
          onClick: () => setIsOpen(true),
          className: "px-3 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 text-xs font-semibold transition-all shrink-0 ml-auto",
          children: "Select Icon"
        }
      )
    ] }),
    mounted && typeof document !== "undefined" && modalContent && (0, import_react_dom2.createPortal)(modalContent, document.body)
  ] });
};

// src/admin/SectionEditorForm.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
function isCodeValue(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === 3 && keys[0] === "css" && keys[1] === "html" && keys[2] === "js" && keys.every((k) => typeof value[k] === "string");
}
var SectionEditorForm = ({
  page,
  sectionKey,
  initialData,
  hasCustomOverride,
  isPublished: initialPublished,
  updatedAt,
  updatedBy,
  onSave,
  onReset,
  onChangeDraft,
  sectionLabel,
  pagePath,
  transform
}) => {
  const { config } = useStudio();
  const collectionLimits = config.collectionLimits ?? {};
  const CodeWidget = config.widgets?.code;
  const getEffectiveInitialData = (data) => {
    return transform ? transform(data) : data;
  };
  const [formData, setFormData] = (0, import_react6.useState)(() => getEffectiveInitialData(initialData));
  const [published, setPublished] = (0, import_react6.useState)(initialPublished);
  const [isSaving, setIsSaving] = (0, import_react6.useState)(false);
  const [isResetting, setIsResetting] = (0, import_react6.useState)(false);
  const [isJsonModalOpen, setIsJsonModalOpen] = (0, import_react6.useState)(false);
  const [isPreviewOpen, setIsPreviewOpen] = (0, import_react6.useState)(false);
  const [isDirty, setIsDirty] = (0, import_react6.useState)(false);
  (0, import_react6.useEffect)(() => {
    setFormData(getEffectiveInitialData(initialData));
    setPublished(initialPublished);
    setIsDirty(false);
  }, [initialData, initialPublished]);
  const cloneData = (obj) => {
    if (obj === null || typeof obj !== "object") return obj;
    return JSON.parse(JSON.stringify(obj));
  };
  const createEmptyTemplate = (template) => {
    if (template === null || template === void 0) return "";
    if (typeof template === "string") return "";
    if (typeof template === "number") return 0;
    if (typeof template === "boolean") return false;
    if (Array.isArray(template)) return [];
    if (typeof template === "object") {
      const empty = {};
      for (const [k, v] of Object.entries(template)) {
        if (k.toLowerCase() === "id") {
          empty[k] = typeof v === "number" ? 0 : `item_${Date.now()}`;
        } else if (typeof v === "string") {
          empty[k] = "";
        } else if (typeof v === "boolean") {
          empty[k] = false;
        } else if (typeof v === "number") {
          empty[k] = 0;
        } else if (Array.isArray(v)) {
          empty[k] = [];
        } else if (typeof v === "object" && v !== null) {
          empty[k] = createEmptyTemplate(v);
        } else {
          empty[k] = "";
        }
      }
      return empty;
    }
    return "";
  };
  const handleFieldChange = (path, value) => {
    setFormData((prev) => {
      const copy = cloneData(prev);
      let curr = copy;
      for (let i = 0; i < path.length - 1; i++) {
        curr = curr[path[i]];
      }
      curr[path[path.length - 1]] = value;
      if (onChangeDraft) {
        onChangeDraft(copy);
      }
      return copy;
    });
    setIsDirty(true);
  };
  const getArrayLimit = (path) => {
    const specificKey = `${page}.${sectionKey}.${path.join(".")}`;
    const directKey = `${page}.${path.join(".")}`;
    const simpleKey = `${sectionKey}.${path.join(".")}`;
    return collectionLimits[specificKey] || collectionLimits[directKey] || collectionLimits[simpleKey] || collectionLimits[`${page}.${sectionKey}`] || null;
  };
  const handleArrayAdd = (path, template) => {
    const limitInfo = getArrayLimit(path);
    setFormData((prev) => {
      const copy = cloneData(prev);
      let curr = copy;
      for (let i = 0; i < path.length; i++) {
        curr = curr[path[i]];
      }
      if (Array.isArray(curr)) {
        if (limitInfo && curr.length >= limitInfo.max) {
          import_react_hot_toast3.default.error(
            `Maximum limit reached: You cannot add more than ${limitInfo.max} ${limitInfo.label} to preserve design and layout integrity.`,
            { duration: 4e3 }
          );
          return prev;
        }
        const newItem = cloneData(createEmptyTemplate(template));
        if (newItem && typeof newItem === "object" && "id" in newItem) {
          newItem.id = typeof template?.id === "number" ? curr.length + 1 : `item_${Date.now()}`;
        }
        curr.push(newItem);
        if (onChangeDraft) {
          onChangeDraft(copy);
        }
      }
      return copy;
    });
    setIsDirty(true);
  };
  const handleArrayDelete = (path, index) => {
    setFormData((prev) => {
      const copy = cloneData(prev);
      let curr = copy;
      for (let i = 0; i < path.length; i++) {
        curr = curr[path[i]];
      }
      if (Array.isArray(curr)) {
        curr.splice(index, 1);
      }
      if (onChangeDraft) {
        onChangeDraft(copy);
      }
      return copy;
    });
    setIsDirty(true);
  };
  const handleArrayMove = (path, index, direction) => {
    setFormData((prev) => {
      const copy = cloneData(prev);
      let curr = copy;
      for (let i = 0; i < path.length; i++) {
        curr = curr[path[i]];
      }
      if (Array.isArray(curr)) {
        const targetIdx = direction === "up" ? index - 1 : index + 1;
        if (targetIdx >= 0 && targetIdx < curr.length) {
          const temp = curr[index];
          curr[index] = curr[targetIdx];
          curr[targetIdx] = temp;
        }
      }
      if (onChangeDraft) {
        onChangeDraft(copy);
      }
      return copy;
    });
    setIsDirty(true);
  };
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData, published);
      setIsDirty(false);
      import_react_hot_toast3.default.success(published ? "Section saved and published" : "Section saved as draft");
    } catch {
      import_react_hot_toast3.default.error("Failed to save section changes");
    } finally {
      setIsSaving(false);
    }
  };
  const handleReset = async () => {
    if (!confirm("Are you sure you want to revert this section to default content? All custom changes will be discarded.")) {
      return;
    }
    setIsResetting(true);
    try {
      await onReset();
      setIsDirty(false);
      import_react_hot_toast3.default.success("Reverted back to default template content");
    } catch {
      import_react_hot_toast3.default.error("Failed to reset section");
    } finally {
      setIsResetting(false);
    }
  };
  const isIconField = (fieldName) => {
    const lower = fieldName.toLowerCase();
    return lower === "icon" || lower.endsWith("icon") || lower.endsWith("_icon") || lower.startsWith("icon") || lower === "iconname" || lower === "badgeicon";
  };
  const isImageField = (fieldName, val) => {
    if (typeof val !== "string") return false;
    if (isIconField(fieldName)) return false;
    const lowerKey = fieldName.toLowerCase();
    const nonImageLabelSuffixes = ["alt", "label", "desc", "description", "title", "heading", "text", "badge"];
    if (nonImageLabelSuffixes.some((s) => lowerKey.endsWith(s) || lowerKey.endsWith(`_${s}`))) {
      return false;
    }
    const imageKeyKeywords = [
      "image",
      "img",
      "avatar",
      "logo",
      "photo",
      "banner",
      "cover",
      "thumbnail",
      "preview",
      "picture",
      "src",
      "ogimage"
    ];
    const hasImageKey = imageKeyKeywords.some((kw) => lowerKey.includes(kw));
    const trimmed = val.trim();
    const hasImageExt = /\.(png|jpe?g|webp|svg|gif|avif|ico)(\?.*)?$/i.test(trimmed);
    const hasImagePath = trimmed.startsWith("/images/") || trimmed.startsWith("/assets/") || trimmed.startsWith("data:image/");
    return hasImageKey || hasImageExt || hasImagePath;
  };
  const renderField = (key, value, path) => {
    const fieldId = path.join(".");
    if (typeof value === "string") {
      const isIdField = key.toLowerCase() === "id";
      if (isIdField) {
        return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "w-full flex items-center justify-between py-1 text-xs border-b border-slate-800/40", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "flex items-center gap-1.5 min-w-0", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_lucide_react5.Lock, { className: "w-3 h-3 text-purple-400 shrink-0" }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "text-slate-400 font-mono text-[11px] shrink-0", children: [
              key,
              ":"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "text-purple-300 font-mono font-medium px-1.5 py-0.2 rounded bg-purple-950/60 text-[11px] truncate", children: value })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "text-[10px] text-slate-500 font-mono shrink-0", children: "system id" })
        ] }, fieldId);
      }
      if (isIconField(key)) {
        return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "w-full py-1", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          VisualIconPicker,
          {
            value,
            onChange: (newIcon) => handleFieldChange(path, newIcon),
            label: key,
            fieldId
          }
        ) }, fieldId);
      }
      if (isImageField(key, value)) {
        return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "w-full py-1", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          VisualImagePicker,
          {
            value,
            onChange: (newUrl) => handleFieldChange(path, newUrl),
            label: key,
            fieldId
          }
        ) }, fieldId);
      }
      const displayLabel = key.replace(/([A-Z])/g, " $1");
      const isLongText = value.length > 70 || value.includes("\n");
      return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "w-full space-y-1 py-1", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "flex items-center justify-between gap-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("label", { className: "text-xs font-semibold text-slate-200 capitalize flex items-center gap-1.5", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: displayLabel }) }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "text-[10px] font-mono text-slate-500", children: fieldId })
        ] }),
        isLongText ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "textarea",
          {
            value,
            rows: 3,
            onChange: (e) => handleFieldChange(path, e.target.value),
            className: "w-full text-xs p-2.5 rounded-lg bg-slate-950/90 border border-slate-700 text-white focus:outline-none focus:border-purple-400 transition-colors"
          }
        ) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "input",
          {
            type: "text",
            value,
            onChange: (e) => handleFieldChange(path, e.target.value),
            className: "w-full text-xs px-3 py-2 rounded-lg bg-slate-950/90 border border-slate-700 text-white focus:outline-none focus:border-purple-400 transition-colors"
          }
        )
      ] }, fieldId);
    }
    if (typeof value === "number") {
      const isIdField = key.toLowerCase() === "id";
      if (isIdField) {
        return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "w-full flex items-center justify-between py-1 text-xs border-b border-slate-800/40", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "flex items-center gap-1.5 min-w-0", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_lucide_react5.Lock, { className: "w-3 h-3 text-purple-400 shrink-0" }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "text-slate-400 font-mono text-[11px] shrink-0", children: [
              key,
              ":"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "text-purple-300 font-mono font-medium px-1.5 py-0.2 rounded bg-purple-950/60 text-[11px] truncate", children: value })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "text-[10px] text-slate-500 font-mono shrink-0", children: "system id" })
        ] }, fieldId);
      }
      return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "w-full space-y-1 py-1", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "flex items-center justify-between gap-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("label", { className: "text-xs font-semibold text-slate-200 capitalize", children: key.replace(/([A-Z])/g, " $1") }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "text-[10px] font-mono text-slate-500", children: fieldId })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "input",
          {
            type: "number",
            value,
            onChange: (e) => handleFieldChange(path, parseFloat(e.target.value) || 0),
            className: "w-full text-xs px-3 py-2 rounded-lg bg-slate-950/90 border border-slate-700 text-white focus:outline-none focus:border-purple-400 font-mono"
          }
        )
      ] }, fieldId);
    }
    if (typeof value === "boolean") {
      return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "w-full flex items-center justify-between py-2 px-2.5 rounded-lg bg-slate-950/60 border border-slate-800", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "text-xs font-semibold text-slate-200 capitalize", children: key.replace(/([A-Z])/g, " $1") }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "block text-[10px] font-mono text-slate-500", children: fieldId })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "input",
          {
            type: "checkbox",
            checked: value,
            onChange: (e) => handleFieldChange(path, e.target.checked),
            className: "w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-700 cursor-pointer"
          }
        )
      ] }, fieldId);
    }
    if (Array.isArray(value)) {
      const isPrimitiveArray = value.length === 0 || typeof value[0] !== "object";
      const itemTemplate = value.length > 0 ? typeof value[0] === "object" ? value[0] : "" : "";
      const limitInfo = getArrayLimit(path);
      const isMaxReached = limitInfo ? value.length >= limitInfo.max : false;
      return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "w-full space-y-2 py-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "flex items-center justify-between pb-1.5 border-b border-purple-500/30", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "text-xs font-bold text-purple-300 capitalize", children: key.replace(/([A-Z])/g, " $1") }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: `text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isMaxReached ? "bg-amber-900/60 text-amber-300 border border-amber-500/30" : "bg-purple-900/60 text-purple-200"}`, children: [
              value.length,
              limitInfo ? ` / ${limitInfo.max} max` : ""
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
            "button",
            {
              type: "button",
              onClick: () => handleArrayAdd(path, itemTemplate),
              className: `flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${isMaxReached ? "bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-700/80" : "bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40"}`,
              title: isMaxReached ? `Limit of ${limitInfo?.max} reached` : "Add new item",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_lucide_react5.Plus, { className: "w-3.5 h-3.5" }),
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: isMaxReached ? "Max Reached" : "Add" })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "space-y-2.5", children: value.map((item, idx) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
          "div",
          {
            className: "p-2.5 sm:p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-colors space-y-2",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "flex items-center justify-between pb-1 border-b border-slate-800/80", children: [
                /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "text-[11px] font-bold text-purple-300", children: [
                  "#",
                  idx + 1
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "flex items-center gap-1", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                    "button",
                    {
                      type: "button",
                      disabled: idx === 0,
                      onClick: () => handleArrayMove(path, idx, "up"),
                      className: "p-1 text-slate-400 hover:text-white disabled:opacity-20 transition-colors",
                      title: "Move Up",
                      children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_lucide_react5.ChevronUp, { className: "w-3.5 h-3.5" })
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                    "button",
                    {
                      type: "button",
                      disabled: idx === value.length - 1,
                      onClick: () => handleArrayMove(path, idx, "down"),
                      className: "p-1 text-slate-400 hover:text-white disabled:opacity-20 transition-colors",
                      title: "Move Down",
                      children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_lucide_react5.ChevronDown, { className: "w-3.5 h-3.5" })
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                    "button",
                    {
                      type: "button",
                      onClick: () => handleArrayDelete(path, idx),
                      className: "p-1 text-slate-400 hover:text-rose-400 transition-colors ml-1",
                      title: "Delete Item",
                      children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_lucide_react5.Trash2, { className: "w-3.5 h-3.5" })
                    }
                  )
                ] })
              ] }),
              isPrimitiveArray ? isImageField(key, item) ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                VisualImagePicker,
                {
                  value: item || "",
                  onChange: (newUrl) => handleFieldChange([...path, idx], newUrl),
                  label: `${key} #${idx + 1}`,
                  fieldId: `${fieldId}.${idx}`
                }
              ) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                "input",
                {
                  type: "text",
                  value: item,
                  onChange: (e) => handleFieldChange([...path, idx], e.target.value),
                  className: "w-full text-xs px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-purple-400"
                }
              ) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "space-y-2 pt-1", children: Object.entries(item).map(
                ([subKey, subVal]) => renderField(subKey, subVal, [...path, idx, subKey])
              ) })
            ]
          },
          `${fieldId}.${idx}`
        )) })
      ] }, fieldId);
    }
    if (typeof value === "object" && value !== null) {
      return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "w-full space-y-2 py-2 border-t border-slate-800/80 first:border-t-0", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "flex items-center gap-1.5 pb-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "text-xs font-bold text-slate-200 capitalize", children: key.replace(/([A-Z])/g, " $1") }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "text-[10px] font-mono text-slate-500", children: [
            "(",
            fieldId,
            ")"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "space-y-2 pl-1", children: Object.entries(value).map(
          ([subKey, subVal]) => renderField(subKey, subVal, [...path, subKey])
        ) })
      ] }, fieldId);
    }
    return null;
  };
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "space-y-4", children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "sticky top-0 z-30 rounded-xl bg-slate-900/95 border border-purple-500/30 overflow-hidden shadow-lg backdrop-blur-md", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "p-3 flex items-center justify-between gap-2 border-b border-purple-500/20", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "flex items-center gap-2 min-w-0", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h2", { className: "text-sm font-bold text-white capitalize truncate", children: sectionLabel || sectionKey.replace(/([A-Z])/g, " $1") }),
          hasCustomOverride ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0 font-medium", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_lucide_react5.CheckCircle2, { className: "w-3 h-3 text-emerald-400 shrink-0" }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: "Custom" })
          ] }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 shrink-0 font-medium", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_lucide_react5.ShieldCheck, { className: "w-3 h-3 text-slate-400 shrink-0" }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: "Default" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
          "button",
          {
            type: "button",
            disabled: isSaving,
            onClick: handleSave,
            className: `inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${isSaving ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/60" : "bg-purple-600 hover:bg-purple-500 text-white shadow-md active:scale-95"}`,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_lucide_react5.Save, { className: "w-3.5 h-3.5 shrink-0" }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: isSaving ? "Saving..." : published ? "Save & Publish" : "Save Draft" })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "px-3 py-2 bg-slate-950/60 flex items-center justify-between gap-2 text-xs text-slate-400", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "flex items-center gap-2 min-w-0 text-[11px]", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "text-purple-300 font-mono truncate", children: pagePath }),
          updatedAt && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "text-slate-500 hidden sm:inline truncate", children: new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "flex items-center gap-1.5 shrink-0", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "button",
            {
              type: "button",
              onClick: () => setIsPreviewOpen(true),
              className: "p-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition-colors",
              title: "Preview Section",
              children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_lucide_react5.Eye, { className: "w-3.5 h-3.5 text-purple-400" })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "button",
            {
              type: "button",
              onClick: () => setIsJsonModalOpen(true),
              className: "p-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition-colors",
              title: "View Raw JSON",
              children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_lucide_react5.Code, { className: "w-3.5 h-3.5 text-emerald-400" })
            }
          ),
          hasCustomOverride && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "button",
            {
              type: "button",
              disabled: isResetting,
              onClick: handleReset,
              className: "p-1.5 rounded-lg text-amber-300 hover:text-amber-200 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-700/60 transition-colors",
              title: "Reset to Template Default",
              children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_lucide_react5.RotateCcw, { className: "w-3.5 h-3.5" })
            }
          )
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "bg-slate-900/80 border border-purple-500/20 rounded-xl p-3 sm:p-4 space-y-3", children: CodeWidget && isCodeValue(formData) ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        CodeWidget,
        {
          value: formData,
          onChange: (next) => {
            const updated = {
              html: next.html,
              css: next.css,
              js: next.js
            };
            setFormData(updated);
            setIsDirty(true);
            if (onChangeDraft) {
              onChangeDraft(updated);
            }
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "flex items-center justify-between pt-3 border-t border-purple-500/20", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "text-xs text-slate-400 flex items-center gap-1.5", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: `w-2 h-2 rounded-full ${isDirty ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}` }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: isDirty ? "Unsaved edits in studio" : "Ready / Up to date" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
          "button",
          {
            type: "button",
            disabled: isSaving,
            onClick: handleSave,
            className: `inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${isSaving ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/60" : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40 active:scale-95"}`,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_lucide_react5.Save, { className: "w-4 h-4 shrink-0" }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: isSaving ? "Saving..." : "Save & Publish" })
            ]
          }
        )
      ] })
    ] }) : formData && typeof formData === "object" ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "space-y-3", children: Object.entries(formData).map(([key, val]) => renderField(key, val, [key])) }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "p-4 text-center text-xs text-slate-400", children: "No editable data found for this section." }) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      JsonInspectorModal,
      {
        isOpen: isJsonModalOpen,
        onClose: () => setIsJsonModalOpen(false),
        sectionTitle: sectionKey,
        jsonData: formData,
        onApply: (data) => {
          setFormData(data);
          setIsDirty(true);
          if (onChangeDraft) {
            onChangeDraft(data);
          }
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      LivePreviewModal,
      {
        isOpen: isPreviewOpen,
        onClose: () => setIsPreviewOpen(false),
        pagePath
      }
    )
  ] });
};

// src/admin/CanvasEditor.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
var DEVICE_VIEWPORTS = {
  desktop: { label: "Desktop", width: 1280, icon: import_lucide_react6.Monitor },
  tablet: { label: "Tablet", width: 768, icon: import_lucide_react6.Tablet },
  mobile: { label: "Mobile", width: 390, icon: import_lucide_react6.Smartphone }
};
var CanvasEditor = ({ initialPage, onPageChange }) => {
  const { config, origins } = useStudio();
  const adapter = config.adapter;
  const [activePage, setActivePage] = (0, import_react7.useState)(initialPage || config.pages[0]?.key || "");
  (0, import_react7.useEffect)(() => {
    if (initialPage) setActivePage(initialPage);
  }, [initialPage]);
  const [device, setDevice] = (0, import_react7.useState)("desktop");
  const [isEditModeActive, setIsEditModeActive] = (0, import_react7.useState)(true);
  const [iframeKey, setIframeKey] = (0, import_react7.useState)(0);
  const [isLoadingIframe, setIsLoadingIframe] = (0, import_react7.useState)(true);
  const pageDef = findPage(config, activePage);
  const availableSections = pageDef?.sections ?? [];
  const [activeSectionKey, setActiveSectionKey] = (0, import_react7.useState)(availableSections[0]?.key ?? "");
  const [sectionDetail, setSectionDetail] = (0, import_react7.useState)(null);
  const [isLoadingDetail, setIsLoadingDetail] = (0, import_react7.useState)(false);
  const iframeRef = (0, import_react7.useRef)(null);
  const viewportContainerRef = (0, import_react7.useRef)(null);
  const [containerSize, setContainerSize] = (0, import_react7.useState)({
    width: 1e3,
    height: 800
  });
  (0, import_react7.useEffect)(() => {
    if (!viewportContainerRef.current) return;
    const updateSize = () => {
      if (viewportContainerRef.current) {
        setContainerSize({
          width: viewportContainerRef.current.clientWidth,
          height: viewportContainerRef.current.clientHeight
        });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewportContainerRef.current);
    return () => observer.disconnect();
  }, []);
  (0, import_react7.useEffect)(() => {
    if (!isLoadingIframe) return;
    const check = () => {
      try {
        const doc = iframeRef.current?.contentDocument;
        if (doc && doc.readyState === "complete" && doc.location.href !== "about:blank") {
          setIsLoadingIframe(false);
        }
      } catch {
      }
    };
    check();
    const interval = setInterval(check, 300);
    const timeout = setTimeout(() => setIsLoadingIframe(false), 1e4);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isLoadingIframe, iframeKey]);
  const currentRoute = pageDef?.route || "/";
  const activePageTitle = pageDef?.title || activePage;
  const activePageIcon = pageDef?.icon || import_lucide_react6.Layers;
  const iframeSrc = buildPreviewUrl(currentRoute, {
    publicSiteUrl: config.publicSiteUrl,
    editMode: isEditModeActive,
    cacheBust: iframeKey
  });
  const sendToPreview = (0, import_react7.useCallback)(
    (message) => {
      postCmsMessage(iframeRef.current?.contentWindow, message, origins);
    },
    [origins]
  );
  const changePage = (pageKey) => {
    setActivePage(pageKey);
    setIsLoadingIframe(true);
    setIframeKey(Date.now());
    if (onPageChange) onPageChange(pageKey);
  };
  const toggleEditMode = () => {
    const next = !isEditModeActive;
    setIsEditModeActive(next);
    sendToPreview({ type: CMS_MESSAGE.SET_EDIT_MODE, enabled: next });
    import_react_hot_toast4.default.success(
      next ? "Edit Mode Active: Hover & click sections to edit" : "Normal Browsing Mode: Edit options hidden",
      { duration: 2500 }
    );
  };
  (0, import_react7.useEffect)(() => {
    if (availableSections.length > 0 && !availableSections.some((section) => section.key === activeSectionKey)) {
      setActiveSectionKey(availableSections[0].key);
    }
  }, [activePage, activeSectionKey, availableSections]);
  const loadSectionData = (0, import_react7.useCallback)(
    async (page, sectionKey) => {
      setIsLoadingDetail(true);
      try {
        const record = await adapter.getRecord(page.key, sectionKey, { includeDrafts: true });
        setSectionDetail(getSectionDetail(page, sectionKey, record));
      } catch {
        import_react_hot_toast4.default.error(`Failed to load data for section '${sectionKey}'`);
      } finally {
        setIsLoadingDetail(false);
      }
    },
    [adapter]
  );
  (0, import_react7.useEffect)(() => {
    if (!pageDef) return;
    const isSectionValid = availableSections.some((section) => section.key === activeSectionKey);
    if (activeSectionKey && isSectionValid) {
      loadSectionData(pageDef, activeSectionKey);
    }
  }, [activePage, activeSectionKey, loadSectionData]);
  const handleSelectSection = (sectionKey) => {
    setActiveSectionKey(sectionKey);
    sendToPreview({ type: CMS_MESSAGE.SCROLL_TO_SECTION, sectionKey });
  };
  (0, import_react7.useEffect)(() => {
    if (origins.length === 0) return;
    return listenForCmsMessages(
      (message) => {
        if (message.type !== CMS_MESSAGE.EDIT_SECTION || !message.sectionKey) return;
        if (!availableSections.some((s) => s.key === message.sectionKey)) {
          import_react_hot_toast4.default.error(`Section '${message.sectionKey}' is not configured for this page`);
          return;
        }
        setActiveSectionKey(message.sectionKey);
        import_react_hot_toast4.default.success(`Selected: ${message.title || message.sectionKey} in Editor`, {
          duration: 2e3
        });
      },
      { origins, source: () => iframeRef.current?.contentWindow }
    );
  }, [origins, availableSections]);
  const handleSaveSection = async (content, isPublished) => {
    if (!pageDef) return;
    await adapter.saveRecord({ page: activePage, sectionKey: activeSectionKey, content, isPublished });
    sendToPreview({
      type: CMS_MESSAGE.DRAFT_PREVIEW,
      page: activePage,
      sectionKey: activeSectionKey,
      draftContent: content
    });
    sendToPreview({ type: CMS_MESSAGE.CONTENT_UPDATED });
    const record = await adapter.getRecord(activePage, activeSectionKey, { includeDrafts: true });
    setSectionDetail(getSectionDetail(pageDef, activeSectionKey, record));
  };
  const handleResetSection = async () => {
    if (!pageDef) return;
    await adapter.deleteRecord(activePage, activeSectionKey);
    sendToPreview({ type: CMS_MESSAGE.CONTENT_UPDATED });
    setSectionDetail(getSectionDetail(pageDef, activeSectionKey, null));
  };
  const handleDraftChange = (draftContent) => {
    sendToPreview({
      type: CMS_MESSAGE.DRAFT_PREVIEW,
      page: activePage,
      sectionKey: activeSectionKey,
      draftContent
    });
  };
  const handleRefreshPreview = () => {
    setIsLoadingIframe(true);
    setIframeKey(Date.now());
  };
  const activeSectionDef = availableSections.find((s) => s.key === activeSectionKey);
  const currentSectionLabel = activeSectionDef?.label || activeSectionKey.replace(/([A-Z])/g, " $1");
  if (!pageDef) {
    return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "p-8 text-center text-sm text-slate-400 bg-slate-900/60 rounded-2xl border border-purple-500/20", children: [
      "No pages configured. Add pages to the ",
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("code", { className: "text-purple-300", children: "pages" }),
      " array of your CMS config."
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "space-y-4", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "p-3 rounded-2xl bg-slate-900/90 border border-purple-500/20 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shadow-xl", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "flex items-center gap-2 flex-wrap", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-600/25 border border-purple-500/40 text-purple-200 shrink-0", children: [
          import_react7.default.createElement(activePageIcon, { className: "w-3.5 h-3.5 text-purple-300" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "font-bold text-white max-w-[150px] truncate", children: activePageTitle }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "text-[10px] font-mono opacity-70 text-purple-300", children: [
            "(",
            currentRoute,
            ")"
          ] })
        ] }),
        config.pages.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "select",
          {
            value: activePage,
            onChange: (e) => {
              if (e.target.value) changePage(e.target.value);
            },
            "aria-label": "Page to edit",
            className: "text-xs px-2.5 py-1.5 rounded-xl bg-slate-950 border border-purple-500/30 text-purple-200 focus:outline-none focus:border-purple-400 max-w-[200px] sm:max-w-[260px] md:max-w-[320px] truncate",
            children: config.pages.map((p) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("option", { value: p.key, children: [
              p.title,
              " (",
              p.route,
              ")"
            ] }, p.key))
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "flex items-center gap-2.5 flex-wrap", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "flex items-center gap-1 p-1 bg-slate-950/70 border border-slate-800 rounded-xl shrink-0", children: Object.keys(DEVICE_VIEWPORTS).map((mode) => {
          const conf = DEVICE_VIEWPORTS[mode];
          const Icon = conf.icon;
          const isCurrent = device === mode;
          return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
            "button",
            {
              type: "button",
              onClick: () => setDevice(mode),
              className: `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isCurrent ? "bg-purple-900/80 text-purple-200 border border-purple-500/40 shadow-sm" : "text-slate-400 hover:text-white"}`,
              title: `${conf.label} (${conf.width}px)`,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Icon, { className: "w-3.5 h-3.5" }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: conf.label })
              ]
            },
            mode
          );
        }) }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "flex items-center gap-1.5 shrink-0", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "button",
            {
              type: "button",
              onClick: toggleEditMode,
              className: `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border shrink-0 ${isEditModeActive ? "bg-purple-600 text-white border-purple-400 shadow-sm shadow-purple-900/30" : "bg-slate-950/70 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800/60"}`,
              title: isEditModeActive ? "Edit Mode is ON. Click to turn OFF and interact with webpage normally." : "Edit Mode is OFF. Click to turn ON and enable section edit buttons.",
              children: isEditModeActive ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse shrink-0" }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_lucide_react6.Pencil, { className: "w-3 h-3 text-purple-200 shrink-0" }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: "Edit Mode" })
              ] }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_lucide_react6.Eye, { className: "w-3 h-3 text-slate-400 shrink-0" }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: "View Mode" })
              ] })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "button",
            {
              type: "button",
              onClick: handleRefreshPreview,
              className: "p-1.5 rounded-lg bg-slate-950/70 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors",
              title: "Reload live canvas",
              children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_lucide_react6.RotateCcw, { className: "w-3.5 h-3.5" })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
            "a",
            {
              href: publicUrl(currentRoute, config.publicSiteUrl),
              target: "_blank",
              rel: "noreferrer",
              className: "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950/70 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-medium transition-colors",
              title: "Open in new window",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_lucide_react6.ExternalLink, { className: "w-3.5 h-3.5" }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "hidden sm:inline", children: "Open Live" })
              ]
            }
          )
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "grid grid-cols-1 lg:grid-cols-12 gap-5 items-start", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "lg:col-span-5 xl:col-span-5 flex flex-col space-y-3 lg:sticky lg:top-2 lg:max-h-[calc(100vh-80px)] overflow-y-auto pr-1 custom-scrollbar", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "p-3 rounded-xl bg-slate-900/95 border border-purple-500/25 backdrop-blur-sm space-y-2.5 shadow-lg", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "text-xs font-bold text-white flex items-center gap-1.5", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: "Select Section to Edit:" }) }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "text-[10px] font-mono text-purple-300 px-2 py-0.5 rounded-full bg-purple-950/60 border border-purple-800/40", children: [
              "Page: ",
              currentRoute
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "flex flex-wrap gap-1.5", children: availableSections.map((sec) => {
            const isSelected = sec.key === activeSectionKey;
            const IconComponent = sec.icon;
            return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
              "button",
              {
                type: "button",
                onClick: () => handleSelectSection(sec.key),
                className: `flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${isSelected ? "bg-purple-600 text-white shadow-md shadow-purple-900/50 ring-1 ring-purple-400" : "bg-slate-950/70 hover:bg-slate-800/80 text-slate-300 border border-slate-800"}`,
                children: [
                  IconComponent && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IconComponent, { className: "w-3.5 h-3.5 opacity-80" }),
                  /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: sec.label }),
                  isSelected && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_lucide_react6.ChevronRight, { className: "w-3 h-3 text-purple-200" })
                ]
              },
              sec.key
            );
          }) }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "flex items-center gap-1.5 text-[11px] text-slate-400 pt-1 border-t border-slate-800/60", children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_lucide_react6.MousePointerClick, { className: "w-3.5 h-3.5 text-purple-400 shrink-0" }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: "Selecting a section scrolls the preview on the right to it." })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "rounded-2xl bg-slate-900/80 border border-purple-500/20 p-3 sm:p-4 shadow-xl", children: isLoadingDetail ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "h-64 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_lucide_react6.Loader2, { className: "w-6 h-6 animate-spin text-purple-400" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: "Loading section form..." })
        ] }) : sectionDetail && sectionDetail.sectionKey === activeSectionKey && sectionDetail.page === activePage ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          SectionEditorForm,
          {
            page: activePage,
            sectionKey: activeSectionKey,
            sectionLabel: activeSectionDef?.label,
            pagePath: currentRoute,
            transform: activeSectionDef?.transform,
            initialData: sectionDetail.content,
            hasCustomOverride: sectionDetail.hasCustomOverride,
            isPublished: sectionDetail.isPublished,
            updatedAt: sectionDetail.updatedAt,
            updatedBy: sectionDetail.updatedBy,
            onSave: handleSaveSection,
            onReset: handleResetSection,
            onChangeDraft: handleDraftChange
          }
        ) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "p-8 text-center text-xs text-slate-400", children: "Select a section to begin editing." }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "lg:col-span-7 xl:col-span-7 flex flex-col space-y-3", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-purple-950/40 border border-purple-500/25 flex items-center justify-between gap-2 text-xs text-purple-200 shadow-md", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "flex items-center gap-2 min-w-0", children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
              "span",
              {
                className: `w-2 h-2 rounded-full shrink-0 ${isEditModeActive ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "truncate", children: isEditModeActive ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
              "Live Interactive Canvas: ",
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("strong", { className: "text-white", children: currentSectionLabel }),
              " is active in editor."
            ] }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
              "Normal Webpage Mode: Interacting normally without edit buttons. Toggle ",
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("strong", { children: "Edit Mode ON" }),
              " to edit."
            ] }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "flex items-center gap-1 text-[11px] text-emerald-300 shrink-0", children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_lucide_react6.CheckCircle2, { className: "w-3.5 h-3.5" }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: isEditModeActive ? "Edit Mode ON" : "Normal View" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
          "div",
          {
            ref: viewportContainerRef,
            className: "relative min-h-[750px] h-[calc(100vh-160px)] bg-slate-950 rounded-2xl border border-purple-500/20 shadow-2xl p-2 sm:p-4 flex flex-col items-center justify-start overflow-hidden",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                "div",
                {
                  className: "absolute inset-0 pointer-events-none opacity-20",
                  style: {
                    backgroundImage: "radial-gradient(circle, #a855f7 1px, transparent 1px)",
                    backgroundSize: "24px 24px"
                  }
                }
              ),
              isLoadingIframe && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm gap-2", children: [
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_lucide_react6.Loader2, { className: "w-8 h-8 text-purple-400 animate-spin" }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "text-xs text-slate-400", children: "Loading interactive preview..." })
              ] }),
              (() => {
                const targetWidth = DEVICE_VIEWPORTS[device].width;
                const availW = Math.max(containerSize.width - 24, 320);
                const availH = Math.max(containerSize.height - 24, 400);
                const scale = availW < targetWidth ? availW / targetWidth : 1;
                const unscaledHeight = availH / scale;
                return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                  "div",
                  {
                    className: "w-full h-full flex items-start justify-center overflow-hidden",
                    style: { width: `${availW}px`, height: `${availH}px` },
                    children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
                      "div",
                      {
                        style: {
                          width: `${targetWidth}px`,
                          height: `${unscaledHeight}px`,
                          transform: `scale(${scale})`,
                          transformOrigin: "top center"
                        },
                        className: `shrink-0 transition-all duration-200 overflow-hidden shadow-2xl border ${device === "mobile" ? "border-slate-700 bg-slate-900 rounded-[38px] p-2 ring-8 ring-slate-800" : device === "tablet" ? "border-slate-700 bg-slate-900 rounded-[28px] p-2 ring-4 ring-slate-800" : "border-slate-800 bg-white rounded-xl"}`,
                        children: [
                          device === "mobile" && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "w-24 h-4 bg-slate-800 rounded-full mx-auto mb-1 flex items-center justify-center", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "w-2 h-2 rounded-full bg-slate-900" }) }),
                          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                            "iframe",
                            {
                              ref: iframeRef,
                              src: iframeSrc,
                              title: "Public Site Live Preview",
                              className: "w-full h-full bg-white block",
                              style: { border: "none" },
                              onLoad: () => setIsLoadingIframe(false)
                            }
                          )
                        ]
                      }
                    )
                  }
                );
              })()
            ]
          }
        )
      ] })
    ] })
  ] });
};

// src/admin/FormStudio.tsx
var import_react8 = require("react");
var import_lucide_react7 = require("lucide-react");
var import_react_hot_toast5 = __toESM(require("react-hot-toast"));
var import_jsx_runtime8 = require("react/jsx-runtime");
var FormStudio = ({ activePage, onPageChange }) => {
  const { config } = useStudio();
  const adapter = config.adapter;
  const [sections, setSections] = (0, import_react8.useState)([]);
  const [selectedSectionKey, setSelectedSectionKey] = (0, import_react8.useState)("");
  const [currentSectionDetail, setCurrentSectionDetail] = (0, import_react8.useState)(null);
  const [loadingSections, setLoadingSections] = (0, import_react8.useState)(true);
  const [loadingDetail, setLoadingDetail] = (0, import_react8.useState)(false);
  const [searchQuery, setSearchQuery] = (0, import_react8.useState)("");
  const loadSections = (0, import_react8.useCallback)(async () => {
    setLoadingSections(true);
    try {
      const records = await adapter.listRecords(void 0, { includeDrafts: true });
      setSections(listManagedSections(config.pages, records));
    } catch (err) {
      console.error(err);
      import_react_hot_toast5.default.error("Failed to load sections");
    } finally {
      setLoadingSections(false);
    }
  }, [adapter, config.pages]);
  (0, import_react8.useEffect)(() => {
    loadSections();
  }, [loadSections]);
  const pageSections = (0, import_react8.useMemo)(
    () => sections.filter((s) => s.page === activePage),
    [sections, activePage]
  );
  const selectedSectionExistsOnPage = pageSections.some((s) => s.sectionKey === selectedSectionKey);
  (0, import_react8.useEffect)(() => {
    if (pageSections.length === 0) return;
    if (!selectedSectionExistsOnPage) {
      setSelectedSectionKey(pageSections[0].sectionKey);
    }
  }, [pageSections, selectedSectionExistsOnPage]);
  const loadSectionDetail = (0, import_react8.useCallback)(
    async (page, sectionKey) => {
      const pageDef2 = findPage(config, page);
      if (!pageDef2 || !sectionKey) return;
      setLoadingDetail(true);
      try {
        const record = await adapter.getRecord(page, sectionKey, { includeDrafts: true });
        setCurrentSectionDetail(getSectionDetail(pageDef2, sectionKey, record));
      } catch (err) {
        console.error(err);
        import_react_hot_toast5.default.error(`Failed to load content for '${sectionKey}'`);
      } finally {
        setLoadingDetail(false);
      }
    },
    [adapter, config]
  );
  (0, import_react8.useEffect)(() => {
    if (!selectedSectionKey || !selectedSectionExistsOnPage) return;
    loadSectionDetail(activePage, selectedSectionKey);
  }, [activePage, selectedSectionKey, selectedSectionExistsOnPage, loadSectionDetail]);
  const handleSaveSection = async (content, isPublished) => {
    await adapter.saveRecord({ page: activePage, sectionKey: selectedSectionKey, content, isPublished });
    await loadSections();
    await loadSectionDetail(activePage, selectedSectionKey);
  };
  const handleResetSection = async () => {
    await adapter.deleteRecord(activePage, selectedSectionKey);
    await loadSections();
    await loadSectionDetail(activePage, selectedSectionKey);
  };
  const pageDef = findPage(config, activePage);
  const labelFor = (key) => pageDef?.sections.find((s) => s.key === key)?.label || key.replace(/([A-Z])/g, " $1");
  const filteredSections = pageSections.filter((s) => {
    const q = searchQuery.toLowerCase();
    return s.sectionKey.toLowerCase().includes(q) || labelFor(s.sectionKey).toLowerCase().includes(q);
  });
  const totalSectionsCount = sections.length;
  const customOverridesCount = sections.filter((s) => s.hasCustomOverride).length;
  const selectedSectionDef = pageDef?.sections.find((s) => s.key === selectedSectionKey);
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "space-y-6", children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-4", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "p-4 rounded-2xl bg-slate-900/70 border border-purple-500/20 flex items-center gap-4", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "p-3 rounded-xl bg-purple-500/10 text-purple-400", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_lucide_react7.Layers, { className: "w-5 h-5" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "text-2xl font-black", children: totalSectionsCount }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "text-xs text-slate-400", children: "Total Editable Sections" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "p-4 rounded-2xl bg-slate-900/70 border border-purple-500/20 flex items-center gap-4", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "p-3 rounded-xl bg-emerald-500/10 text-emerald-400", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_lucide_react7.CheckCircle2, { className: "w-5 h-5" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "text-2xl font-black text-emerald-400", children: customOverridesCount }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "text-xs text-slate-400", children: "Custom Overrides" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "p-4 rounded-2xl bg-slate-900/70 border border-purple-500/20 flex items-center gap-4", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "p-3 rounded-xl bg-blue-500/10 text-blue-400", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_lucide_react7.Database, { className: "w-5 h-5" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "text-2xl font-black text-blue-300", children: totalSectionsCount - customOverridesCount }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "text-xs text-slate-400", children: "Using Defaults" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "flex items-center gap-2 border-b border-purple-500/20 pb-2 overflow-x-auto", children: config.pages.map(({ key, title, route, icon: Icon }) => {
      const isActive = activePage === key;
      const count = sections.filter((s) => s.page === key).length;
      return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
        "button",
        {
          type: "button",
          onClick: () => onPageChange(key),
          className: `flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm whitespace-nowrap transition-all ${isActive ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30" : "text-slate-400 hover:text-white hover:bg-slate-800/80"}`,
          children: [
            Icon && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Icon, { className: "w-4 h-4" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: title }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/30 text-purple-200", children: route }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: `text-[10px] px-1.5 py-0.5 rounded-full font-mono ${isActive ? "bg-purple-700 text-white" : "bg-slate-800 text-slate-400"}`, children: count })
          ]
        },
        key
      );
    }) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "lg:col-span-4 bg-slate-900/70 border border-purple-500/20 rounded-2xl p-4 backdrop-blur-sm space-y-4", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "relative", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_lucide_react7.Search, { className: "w-4 h-4 absolute left-3 top-3 text-slate-400" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "input",
            {
              type: "text",
              placeholder: "Search sections...",
              value: searchQuery,
              onChange: (e) => setSearchQuery(e.target.value),
              className: "w-full text-xs pl-9 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "space-y-1.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1.5 custom-scrollbar", children: loadingSections ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "p-4 text-center text-xs text-slate-500", children: "Loading sections..." }) : filteredSections.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "p-4 text-center text-xs text-slate-500", children: "No matching sections found." }) : filteredSections.map((sec) => {
          const isSelected = sec.sectionKey === selectedSectionKey;
          return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
            "button",
            {
              type: "button",
              onClick: () => setSelectedSectionKey(sec.sectionKey),
              className: `w-full flex items-center justify-between p-3 rounded-xl text-left transition-all ${isSelected ? "bg-purple-600/30 border border-purple-500 text-white shadow-sm" : "bg-slate-950/40 hover:bg-slate-800/60 border border-slate-800/60 text-slate-300"}`,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "flex items-center gap-2.5", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                    "span",
                    {
                      className: `w-2 h-2 rounded-full shrink-0 ${sec.hasCustomOverride ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" : "bg-slate-600"}`
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "text-xs font-semibold capitalize", children: labelFor(sec.sectionKey) }),
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "text-[10px] text-slate-500 font-mono", children: [
                      "key: ",
                      sec.sectionKey
                    ] })
                  ] })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { children: sec.hasCustomOverride ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium", children: "Custom" }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400", children: "Default" }) })
              ]
            },
            sec.sectionKey
          );
        }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "lg:col-span-8", children: loadingDetail ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "p-12 text-center text-sm text-slate-400 bg-slate-900/60 rounded-2xl border border-purple-500/20", children: "Loading section data..." }) : currentSectionDetail ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        SectionEditorForm,
        {
          page: activePage,
          sectionKey: selectedSectionKey,
          sectionLabel: selectedSectionDef?.label,
          pagePath: pageDef?.route || "/",
          transform: selectedSectionDef?.transform,
          initialData: currentSectionDetail.content,
          hasCustomOverride: currentSectionDetail.hasCustomOverride,
          isPublished: currentSectionDetail.isPublished,
          updatedAt: currentSectionDetail.updatedAt,
          updatedBy: currentSectionDetail.updatedBy,
          onSave: handleSaveSection,
          onReset: handleResetSection
        },
        `${activePage}-${selectedSectionKey}`
      ) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "p-12 text-center text-sm text-slate-400 bg-slate-900/60 rounded-2xl border border-purple-500/20", children: "Select a section from the list to begin editing." }) })
    ] })
  ] });
};

// src/admin/CmsStudio.tsx
var import_jsx_runtime9 = require("react/jsx-runtime");
function StudioContent({ config, initialPage, onPageChange, defaultMode = "canvas" }) {
  const firstPage = config.pages[0]?.key ?? "";
  const [activePage, setActivePage] = (0, import_react9.useState)(
    initialPage && findPage(config, initialPage) ? initialPage : firstPage
  );
  const [isGlobalPreviewOpen, setIsGlobalPreviewOpen] = (0, import_react9.useState)(false);
  const [editorMode, setEditorMode] = (0, import_react9.useState)(defaultMode);
  (0, import_react9.useEffect)(() => {
    if (initialPage && findPage(config, initialPage)) setActivePage(initialPage);
  }, [initialPage, config]);
  const changePage = (page) => {
    setActivePage(page);
    if (onPageChange) onPageChange(page);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: `p-4 sm:p-6 lg:p-8 space-y-6 text-white mx-auto ${editorMode === "canvas" ? "max-w-[1920px]" : "max-w-7xl"}`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "flex flex-col md:flex-row justify-between items-start md:items-center gap-4", children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "p-2.5 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_lucide_react8.Globe, { className: "w-6 h-6" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("h1", { className: "text-2xl sm:text-3xl font-extrabold tracking-tight text-white", children: config.title || "Site CMS" }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: "text-xs sm:text-sm text-slate-400 mt-1", children: "Live content editor for your public pages." })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "flex items-center gap-3", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
        "button",
        {
          type: "button",
          onClick: () => setIsGlobalPreviewOpen(true),
          className: "flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 transition-all",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_lucide_react8.Eye, { className: "w-4 h-4" }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { children: "Launch Live Preview" })
          ]
        }
      ) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 bg-slate-900/90 border border-purple-500/25 rounded-2xl shadow-xl", children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "flex items-center gap-1.5 p-1 bg-slate-950/80 border border-slate-800 rounded-xl", children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
          "button",
          {
            type: "button",
            onClick: () => setEditorMode("canvas"),
            className: `flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${editorMode === "canvas" ? "bg-purple-600 text-white shadow-md shadow-purple-900/50" : "text-slate-400 hover:text-white"}`,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_lucide_react8.Wand2, { className: "w-4 h-4 text-purple-300" }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { children: "Visual Interactive Canvas" })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
          "button",
          {
            type: "button",
            onClick: () => setEditorMode("form"),
            className: `flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${editorMode === "form" ? "bg-purple-600 text-white shadow-md shadow-purple-900/50" : "text-slate-400 hover:text-white"}`,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_lucide_react8.Sliders, { className: "w-4 h-4 text-purple-300" }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { children: "Form Studio" })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: "text-xs text-slate-400 px-2 hidden md:block", children: editorMode === "canvas" ? "Hover over any section in the live preview or select from the editor panel." : "Pick a section from the list and edit its fields." })
    ] }),
    editorMode === "canvas" ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(CanvasEditor, { initialPage: activePage, onPageChange: changePage }) : /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(FormStudio, { activePage, onPageChange: changePage }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      LivePreviewModal,
      {
        isOpen: isGlobalPreviewOpen,
        onClose: () => setIsGlobalPreviewOpen(false),
        pagePath: findPage(config, activePage)?.route || "/"
      }
    )
  ] });
}
var CmsStudio = (props) => {
  const { config, toaster = true } = props;
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(StudioProvider, { config, children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "min-h-full bg-slate-950", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(StudioContent, { ...props }) }),
    toaster && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_hot_toast6.Toaster, { position: "top-right" })
  ] });
};

// src/admin/CmsNavButton.tsx
var import_lucide_react9 = require("lucide-react");
var import_jsx_runtime10 = require("react/jsx-runtime");
var CmsNavButton = ({
  href,
  active = false,
  label = "CMS",
  as: Component = "a",
  className,
  ...rest
}) => /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
  Component,
  {
    href,
    "aria-current": active ? "page" : void 0,
    className: className ?? `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30" : "text-slate-400 hover:text-white hover:bg-slate-800/80"}`,
    ...rest,
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_lucide_react9.Globe, { className: "w-5 h-5" }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { children: label })
    ]
  }
);

// src/admin/CmsAuth.tsx
var import_react10 = require("react");
var import_lucide_react10 = require("lucide-react");
var import_jsx_runtime11 = require("react/jsx-runtime");
function safeNext(value) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : null;
}
var CmsLogin = ({ auth, title = "Sign in to edit your site", onSuccess, redirectTo = "/" }) => {
  const [username, setUsername] = (0, import_react10.useState)("");
  const [password, setPassword] = (0, import_react10.useState)("");
  const [error, setError] = (0, import_react10.useState)("");
  const [busy, setBusy] = (0, import_react10.useState)(false);
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const user = await auth.login(username.trim(), password);
      if (onSuccess) onSuccess(user);
      else window.location.assign(safeNext(new URLSearchParams(window.location.search).get("next")) ?? redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
      setPassword("");
      setBusy(false);
    }
  };
  const field = "w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30";
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "flex min-h-[70vh] items-center justify-center px-4 py-10 text-white", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("form", { onSubmit: submit, className: "w-full max-w-sm space-y-5 rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl", children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "flex flex-col items-center gap-3 text-center", children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "rounded-xl border border-purple-500/30 bg-purple-600/20 p-3 text-purple-400", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_lucide_react10.Lock, { className: "h-6 w-6" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("h1", { className: "text-xl font-bold", children: title }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { className: "text-xs text-slate-400", children: "Use your staff username and password." })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("label", { className: "block space-y-1.5 text-xs font-semibold text-slate-300", children: [
      "Username",
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("input", { className: field, value: username, onChange: (e) => setUsername(e.target.value), autoComplete: "username", autoFocus: true, required: true })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("label", { className: "block space-y-1.5 text-xs font-semibold text-slate-300", children: [
      "Password",
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("input", { className: field, type: "password", value: password, onChange: (e) => setPassword(e.target.value), autoComplete: "current-password", required: true })
    ] }),
    error && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { role: "alert", className: "rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300", children: error }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
      "button",
      {
        type: "submit",
        disabled: busy,
        className: "flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-purple-500 disabled:opacity-60",
        children: [
          busy && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_lucide_react10.Loader2, { className: "h-4 w-4 animate-spin" }),
          busy ? "Signing in..." : "Sign in"
        ]
      }
    )
  ] }) });
};
var CmsAuthGate = ({ auth, loginPath, title, children }) => {
  const [state, setState] = (0, import_react10.useState)("checking");
  const [message, setMessage] = (0, import_react10.useState)("");
  const verify = (0, import_react10.useCallback)(async () => {
    if (loginPath && window.location.pathname === loginPath) {
      setState("login-page");
      return;
    }
    setState("checking");
    try {
      const user = await auth.check();
      if (user) return setState("in");
      if (loginPath) {
        const back = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.replace(`${loginPath}?next=${back}`);
        return;
      }
      setState("out");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not check your sign-in.");
      setState("error");
    }
  }, [auth, loginPath]);
  (0, import_react10.useEffect)(() => {
    void verify();
  }, [verify]);
  if (state === "in" || state === "login-page") return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_jsx_runtime11.Fragment, { children });
  if (state === "out") return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(CmsLogin, { auth, title, onSuccess: () => void verify() });
  if (state === "error") {
    return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center text-white", children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { className: "text-sm text-slate-300", children: message }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { type: "button", onClick: () => void verify(), className: "rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold hover:bg-purple-500", children: "Try again" })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "flex min-h-[40vh] items-center justify-center text-slate-400", role: "status", "aria-label": "Checking your sign-in", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_lucide_react10.Loader2, { className: "h-6 w-6 animate-spin" }) });
};
var CmsLogoutButton = ({ auth, redirectTo = "/", className, children }) => /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
  "button",
  {
    type: "button",
    className: className ?? "inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700",
    onClick: () => {
      auth.logout();
      window.location.assign(redirectTo);
    },
    children: children ?? /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_jsx_runtime11.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_lucide_react10.LogOut, { className: "h-3.5 w-3.5" }),
      " Sign out"
    ] })
  }
);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CmsAuthGate,
  CmsLogin,
  CmsLogoutButton,
  CmsNavButton,
  CmsStudio,
  POPULAR_ICONS,
  getDynamicIcon,
  safeNext
});
