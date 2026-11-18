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
} from "./chunk-7UG44WXN.mjs";

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
import { createPortal } from "react-dom";
import { Pencil } from "lucide-react";
import { Fragment, jsx as jsx2, jsxs } from "react/jsx-runtime";
var BUTTON_TOP = {
  inside: 24,
  "inside-low": 112,
  fixed: 96
};
var BUTTON_RIGHT = 32;
var WINDOW_MARGIN = 8;
var BUTTON_HEIGHT = 56;
var BUTTON_Z_INDEX = 2147483e3;
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
  const [isHovered, setIsHovered] = useState3(false);
  const [buttonPosition, setButtonPosition] = useState3(null);
  const sectionRef = useRef(null);
  const buttonRef = useRef(null);
  const originsKey = origins.join("|");
  useEffect3(() => {
    setPathname(window.location.pathname);
  }, []);
  const isValidPath = !activeOnPath || pathname === activeOnPath;
  const showButton = isEditMode && isValidPath && (isHovered || isTargeted);
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
  useEffect3(() => {
    if (!showButton) {
      setButtonPosition(null);
      return;
    }
    const update = () => {
      const section = sectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const isFixed = buttonPlacement === "fixed" || rect.width === 0;
      const right = isFixed ? BUTTON_RIGHT : Math.max(WINDOW_MARGIN, document.documentElement.clientWidth - rect.right + BUTTON_RIGHT);
      const wanted = isFixed ? BUTTON_TOP[buttonPlacement] : rect.top + BUTTON_TOP[buttonPlacement];
      const lowest = Math.max(WINDOW_MARGIN, window.innerHeight - BUTTON_HEIGHT - WINDOW_MARGIN);
      const top = Math.min(Math.max(WINDOW_MARGIN, wanted), lowest);
      setButtonPosition((prev) => prev && prev.top === top && prev.right === right ? prev : { top, right });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [showButton, buttonPlacement]);
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
  const handleMouseOver = (e) => {
    const target = e.target;
    if (buttonRef.current?.contains(target)) return;
    setIsHovered(target.closest("[data-cms-section]") === sectionRef.current);
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
      onMouseOver: handleMouseOver,
      onMouseLeave: () => setIsHovered(false),
      className: `relative transition-all duration-300 cursor-pointer rounded-2xl ${isTargeted ? "ring-4 ring-purple-500 ring-offset-4 ring-offset-slate-950 shadow-[0_0_60px_rgba(168,85,247,0.5)]" : isHovered ? "ring-2 ring-purple-500 ring-offset-2 ring-offset-slate-900" : ""}`,
      children: [
        children,
        showButton && buttonPosition && createPortal(
          /* @__PURE__ */ jsx2(
            "div",
            {
              ref: buttonRef,
              "data-cms-edit-button": sectionKey,
              style: { position: "fixed", top: buttonPosition.top, right: buttonPosition.right, zIndex: BUTTON_Z_INDEX },
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
          document.body
        )
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
