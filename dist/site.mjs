"use client";
import {
  CMS_MESSAGE,
  EDIT_MODE_PARAM,
  PREVIEW_PARAM,
  findPage,
  listenForCmsMessages,
  mergePageContent,
  postCmsMessage,
  trustedOrigins
} from "./chunk-PRSFT74C.mjs";

// src/site/CmsProvider.tsx
import { createContext, useContext, useEffect as useEffect2, useMemo, useState as useState2 } from "react";

// src/site/preview.ts
import { useEffect, useState } from "react";
function hasParam(name) {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has(name);
}
function isCmsPreview() {
  return hasParam(PREVIEW_PARAM) || hasParam(EDIT_MODE_PARAM);
}
function useCmsEditMode(origins) {
  const [isEditMode, setIsEditMode] = useState(false);
  const originsKey = origins.join("|");
  useEffect(() => {
    setIsEditMode(hasParam(EDIT_MODE_PARAM));
    if (typeof window === "undefined" || window.parent === window) return;
    return listenForCmsMessages(
      (message) => {
        if (message.type === CMS_MESSAGE.SET_EDIT_MODE) setIsEditMode(Boolean(message.enabled));
      },
      { origins, source: () => window.parent }
    );
  }, [originsKey]);
  return isEditMode;
}

// src/site/CmsProvider.tsx
import { jsx } from "react/jsx-runtime";
var CmsContext = createContext(null);
var CmsProvider = ({ config, initialContent, children }) => {
  const [origins, setOrigins] = useState2([]);
  useEffect2(() => {
    setOrigins(trustedOrigins(config.allowedOrigins ?? []));
  }, [config.allowedOrigins]);
  const value = useMemo(
    () => ({ config, initialContent: initialContent ?? {}, origins }),
    [config, initialContent, origins]
  );
  return /* @__PURE__ */ jsx(CmsContext.Provider, { value, children });
};
function useCmsContext() {
  const ctx = useContext(CmsContext);
  if (!ctx) {
    throw new Error("[visual-cms] Wrap your site in <CmsProvider config={...}> before using CMS hooks.");
  }
  return ctx;
}
function useCmsConfig() {
  return useCmsContext().config;
}
function usePageContent(pageKey, options = {}) {
  const { config, initialContent, origins } = useCmsContext();
  const page = findPage(config, pageKey);
  if (!page) {
    throw new Error(`[visual-cms] Unknown page "${pageKey}". Add it to the "pages" array of your CMS config.`);
  }
  const [content, setContent] = useState2(
    () => options.initialData ?? initialContent[pageKey] ?? mergePageContent(page, [])
  );
  const originsKey = origins.join("|");
  useEffect2(() => {
    let isMounted = true;
    const includeDrafts = isCmsPreview();
    const fetchPage = async () => {
      try {
        const records = await config.adapter.listRecords(pageKey, { includeDrafts });
        if (isMounted) setContent(mergePageContent(page, records, { includeDrafts }));
      } catch {
      }
    };
    fetchPage();
    if (typeof window === "undefined" || window.parent === window || origins.length === 0) {
      return () => {
        isMounted = false;
      };
    }
    const unsubscribe = listenForCmsMessages(
      (message) => {
        if (message.type === CMS_MESSAGE.CONTENT_UPDATED) {
          fetchPage();
        } else if (message.type === CMS_MESSAGE.DRAFT_PREVIEW && message.page === pageKey) {
          setContent((prev) => ({
            ...prev,
            [message.sectionKey]: message.draftContent
          }));
        }
      },
      { origins, source: () => window.parent }
    );
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [pageKey, config.adapter, originsKey]);
  return content;
}

// src/site/CmsSection.tsx
import { useState as useState3, useEffect as useEffect3, useRef } from "react";
import { Pencil } from "lucide-react";
import { Fragment, jsx as jsx2, jsxs } from "react/jsx-runtime";
var BUTTON_PLACEMENT_CLASSES = {
  inside: "absolute top-6 right-8 z-40",
  "inside-low": "absolute top-28 right-8 z-40",
  fixed: "fixed top-24 right-8 z-[10000]"
};
var CmsSection = ({
  sectionKey,
  title,
  activeOnPath,
  buttonPlacement = "inside",
  children
}) => {
  const { origins } = useCmsContext();
  const isEditMode = useCmsEditMode(origins);
  const [pathname, setPathname] = useState3(null);
  const [isTargeted, setIsTargeted] = useState3(false);
  const sectionRef = useRef(null);
  const originsKey = origins.join("|");
  useEffect3(() => {
    setPathname(window.location.pathname);
  }, []);
  const isValidPath = !activeOnPath || pathname === activeOnPath;
  useEffect3(() => {
    if (!isEditMode) return;
    let timer;
    const unsubscribe = listenForCmsMessages(
      (message) => {
        if (message.type === CMS_MESSAGE.SCROLL_TO_SECTION && message.sectionKey === sectionKey) {
          if (sectionRef.current) {
            sectionRef.current.scrollIntoView({
              behavior: "smooth",
              block: "center"
            });
            setIsTargeted(true);
            clearTimeout(timer);
            timer = setTimeout(() => setIsTargeted(false), 2400);
          }
        }
      },
      { origins, source: () => window.parent }
    );
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [isEditMode, sectionKey, originsKey]);
  const handleEditClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof window !== "undefined" && window.parent && window.parent !== window) {
      postCmsMessage(
        window.parent,
        {
          type: CMS_MESSAGE.EDIT_SECTION,
          sectionKey,
          title
        },
        origins
      );
    }
  };
  if (!isEditMode || !isValidPath) {
    return /* @__PURE__ */ jsx2(Fragment, { children });
  }
  return /* @__PURE__ */ jsxs(
    "div",
    {
      ref: sectionRef,
      "data-cms-section": sectionKey,
      onClick: handleEditClick,
      className: `relative group/cms-section transition-all duration-300 cursor-pointer rounded-2xl ${isTargeted ? "ring-4 ring-purple-500 ring-offset-4 ring-offset-slate-950 shadow-[0_0_60px_rgba(168,85,247,0.5)]" : "hover:ring-2 hover:ring-purple-500 hover:ring-offset-2 hover:ring-offset-slate-900"}`,
      children: [
        /* @__PURE__ */ jsx2(
          "div",
          {
            className: `pointer-events-auto transition-all duration-200 transform group-hover/cms-section:scale-100 scale-95 ${isTargeted ? "opacity-100 scale-100" : "opacity-0 group-hover/cms-section:opacity-100"} ${BUTTON_PLACEMENT_CLASSES[buttonPlacement]}`,
            children: /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: handleEditClick,
                className: "flex items-center gap-2.5 px-5 py-2.5 sm:px-6 sm:py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-sm sm:text-base tracking-wide shadow-2xl shadow-purple-950/80 border-2 border-purple-300/80 backdrop-blur-xl cursor-pointer transition-all hover:scale-105 active:scale-95 whitespace-nowrap",
                title: `Edit ${title} in the editor panel`,
                children: [
                  /* @__PURE__ */ jsx2(Pencil, { className: "w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5] text-purple-100" }),
                  /* @__PURE__ */ jsxs("span", { className: "drop-shadow-sm", children: [
                    "Edit ",
                    title
                  ] })
                ]
              }
            )
          }
        ),
        children
      ]
    }
  );
};
export {
  CmsProvider,
  CmsSection,
  isCmsPreview,
  useCmsConfig,
  useCmsEditMode,
  usePageContent
};
