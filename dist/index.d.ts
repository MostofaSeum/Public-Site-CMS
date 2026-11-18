import { a as CmsConfig, P as PageDef, S as SectionRecord, b as SectionDetail, c as SectionMetadata } from './types-B3IuU7DM.js';
export { C as CmsStorageAdapter, d as CmsWidgets, e as CodeValue, f as CodeWidgetProps, g as CollectionLimit, I as IconComponent, h as ImagePreset, i as ImagePresetCategory, L as ListOptions, M as MediaItem, j as SaveRecordInput, k as SectionDef } from './types-B3IuU7DM.js';
import 'react';

/** True for keys safe to use as page or section identifiers in storage and URLs. */
declare function isValidKey(key: string): boolean;
/**
 * Validate and return a CMS configuration. Throws on duplicate or malformed keys
 * so mistakes surface at startup instead of as silent save failures.
 */
declare function defineCms(config: CmsConfig): CmsConfig;
declare function findPage(config: Pick<CmsConfig, 'pages'>, pageKey: string): PageDef | undefined;

/**
 * Full content of a page: its defaults, with each saved override replacing its
 * section. Unpublished overrides are applied only when `includeDrafts` is true.
 */
declare function mergePageContent<T = Record<string, unknown>>(page: PageDef, records: SectionRecord[], options?: {
    includeDrafts?: boolean;
}): T;
/** Every editable section key of a page: its defaults' keys, then any extra declared sections. */
declare function getSectionKeys(page: PageDef): string[];
/** Metadata for every editable section of the given pages. */
declare function listManagedSections(pages: PageDef[], records: SectionRecord[]): SectionMetadata[];
/**
 * One section as the editor sees it: the saved override (draft or published) if
 * there is one, otherwise the default. Returns null for an unknown section.
 */
declare function getSectionDetail<T = unknown>(page: PageDef, sectionKey: string, record: SectionRecord | null): SectionDetail<T> | null;

/**
 * Messages exchanged between the studio (parent window) and the public page in
 * the preview iframe. Names are part of the public protocol; keep them stable.
 */
declare const CMS_MESSAGE: {
    /** iframe -> studio: a section's edit button was clicked. */
    readonly EDIT_SECTION: "CMS_EDIT_SECTION";
    /** studio -> iframe: scroll to and highlight a section. */
    readonly SCROLL_TO_SECTION: "SCROLL_TO_SECTION";
    /** studio -> iframe: show or hide the edit affordances. */
    readonly SET_EDIT_MODE: "SET_CMS_EDIT_MODE";
    /** studio -> iframe: unsaved form content to render immediately. */
    readonly DRAFT_PREVIEW: "CMS_DRAFT_PREVIEW";
    /** studio -> iframe: content was saved or reset, fetch it again. */
    readonly CONTENT_UPDATED: "CMS_CONTENT_UPDATED";
};
/** Query flag that marks a page as loaded inside the studio. */
declare const PREVIEW_PARAM = "cms_preview";
/** Query flag that turns the hover-to-edit buttons on. */
declare const EDIT_MODE_PARAM = "cms_edit_mode";
type CmsMessage = {
    type: typeof CMS_MESSAGE.EDIT_SECTION;
    sectionKey: string;
    title?: string;
} | {
    type: typeof CMS_MESSAGE.SCROLL_TO_SECTION;
    sectionKey: string;
} | {
    type: typeof CMS_MESSAGE.SET_EDIT_MODE;
    enabled: boolean;
} | {
    type: typeof CMS_MESSAGE.DRAFT_PREVIEW;
    page: string;
    sectionKey: string;
    draftContent: unknown;
} | {
    type: typeof CMS_MESSAGE.CONTENT_UPDATED;
};
declare function isCmsMessage(data: unknown): data is CmsMessage;
/** Origin of a URL, or null when it cannot be parsed. */
declare function originOf(url: string | undefined | null, base?: string): string | null;
/** The current window's origin plus any extra allowed origins, de-duplicated. */
declare function trustedOrigins(extra?: (string | null | undefined)[]): string[];
/**
 * Send a message to another window, once per trusted origin. The browser drops
 * the copies whose origin does not match the target, so content never leaks to
 * an unexpected page (unlike posting with "*").
 */
declare function postCmsMessage(target: Window | null | undefined, message: CmsMessage, origins: string[]): void;
/** Subscribe to CMS messages from trusted origins (and optionally one source window). */
declare function listenForCmsMessages(handler: (message: CmsMessage, event: MessageEvent) => void, options: {
    origins: string[];
    source?: () => Window | null | undefined;
}): () => void;

/** Absolute public URL of a route, using `publicSiteUrl` when the site runs on another origin. */
declare function publicUrl(route: string, publicSiteUrl?: string): string;
/** URL loaded in the studio's preview iframe. */
declare function buildPreviewUrl(route: string, options?: {
    publicSiteUrl?: string;
    editMode?: boolean;
    cacheBust?: number | string;
}): string;

export { CMS_MESSAGE, CmsConfig, type CmsMessage, EDIT_MODE_PARAM, PREVIEW_PARAM, PageDef, SectionDetail, SectionMetadata, SectionRecord, buildPreviewUrl, defineCms, findPage, getSectionDetail, getSectionKeys, isCmsMessage, isValidKey, listManagedSections, listenForCmsMessages, mergePageContent, originOf, postCmsMessage, publicUrl, trustedOrigins };
