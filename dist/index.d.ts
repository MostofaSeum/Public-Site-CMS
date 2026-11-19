import { a as CmsConfig, P as PageDef, S as SectionRecord, b as SectionDetail, c as SectionMetadata, d as CollectionItemSummary } from './types-Dz7fHJXe.js';
export { C as CmsStorageAdapter, e as CmsWidgets, f as CodeValue, g as CodeWidgetProps, h as CollectionLimit, I as IconComponent, i as ImagePreset, j as ImagePresetCategory, L as ListOptions, M as MediaItem, k as SaveRecordInput, l as SectionDef } from './types-Dz7fHJXe.js';
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
    /** iframe -> studio: a section's, a single field's or a record field's edit button was clicked. */
    readonly EDIT_SECTION: "CMS_EDIT_SECTION";
    /** studio -> iframe: scroll to and highlight a section. */
    readonly SCROLL_TO_SECTION: "SCROLL_TO_SECTION";
    /** studio -> iframe: show or hide the edit affordances. */
    readonly SET_EDIT_MODE: "SET_CMS_EDIT_MODE";
    /** studio -> iframe: unsaved form content to render immediately. */
    readonly DRAFT_PREVIEW: "CMS_DRAFT_PREVIEW";
    /** studio -> iframe: content was saved or reset, fetch it again. */
    readonly CONTENT_UPDATED: "CMS_CONTENT_UPDATED";
    /** studio -> iframe: unsaved values of a collection record, to render immediately. */
    readonly ITEM_DRAFT: "CMS_ITEM_DRAFT";
};
/** Query flag that marks a page as loaded inside the studio. */
declare const PREVIEW_PARAM = "cms_preview";
/** Query flag that turns the hover-to-edit buttons on. */
declare const EDIT_MODE_PARAM = "cms_edit_mode";
type CmsMessage = {
    type: typeof CMS_MESSAGE.EDIT_SECTION;
    sectionKey: string;
    title?: string;
    fieldPath?: string;
    /** Set when the field belongs to a collection record instead of a section. */
    collection?: string;
    item?: string;
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
} | {
    type: typeof CMS_MESSAGE.ITEM_DRAFT;
    collection: string;
    item: string;
    values: Record<string, unknown> | null;
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

/** True for routes with a [param] segment, such as "/blog/[slug]". */
declare function isDynamicRoute(route: string): boolean;
/**
 * The public URL of one record: each [name] in the route is replaced by `item.params[name]`,
 * or by the id when there is no such param. "/blog/[slug]" + { id: "school" } -> "/blog/school".
 */
declare function fillRoute(route: string, item: Pick<CollectionItemSummary, 'id' | 'params'>): string;
/** Pages shown in the studio's page menu: every page that does not belong to a parent page. */
declare function topLevelPages(config: Pick<CmsConfig, 'pages'>): PageDef[];
/** The top-level page a page is listed under (itself when it has no parent). */
declare function groupPageOf(config: Pick<CmsConfig, 'pages'>, page: PageDef): PageDef;
/**
 * The pages whose records appear in the record menu of a top-level page: its children with a
 * collection, plus the page itself when it shows records.
 */
declare function recordPagesOf(config: Pick<CmsConfig, 'pages'>, group: PageDef): PageDef[];

export { CMS_MESSAGE, CmsConfig, type CmsMessage, CollectionItemSummary, EDIT_MODE_PARAM, PREVIEW_PARAM, PageDef, SectionDetail, SectionMetadata, SectionRecord, buildPreviewUrl, defineCms, fillRoute, findPage, getSectionDetail, getSectionKeys, groupPageOf, isCmsMessage, isDynamicRoute, isValidKey, listManagedSections, listenForCmsMessages, mergePageContent, originOf, postCmsMessage, publicUrl, recordPagesOf, topLevelPages, trustedOrigins };
