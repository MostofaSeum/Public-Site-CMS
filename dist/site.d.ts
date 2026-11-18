import React from 'react';
import { C as CmsConfig } from './types-Df7jmywN.js';

interface CmsProviderProps {
    config: CmsConfig;
    /**
     * Content already loaded on the server (e.g. with `getPageContent` from
     * "@brainicon/visual-cms/next"), keyed by page key. Avoids a flash of default content.
     */
    initialContent?: Record<string, Record<string, unknown>>;
    children: React.ReactNode;
}
/** Makes the CMS configuration available to `usePageContent` and `CmsSection`. */
declare const CmsProvider: React.FC<CmsProviderProps>;
/** The CMS configuration passed to the nearest CmsProvider. */
declare function useCmsConfig(): CmsConfig;
/**
 * Live content for a page: defaults overlaid by published overrides. Inside the
 * studio preview it also applies unsaved edits as you type and refetches after a save.
 */
declare function usePageContent<T = Record<string, any>>(pageKey: string, options?: {
    /** Content loaded on the server for this page (e.g. with `getPageContent`). */
    initialData?: T;
}): T;

interface CmsSectionProps {
    sectionKey: string;
    title: string;
    /**
     * Optional pathname (for example "/") that this section belongs to.
     * Shared components such as a navbar render on every page, so without this
     * guard their edit button would appear on pages that do not own the section.
     */
    activeOnPath?: string;
    /**
     * Where the floating edit button sits. Use "fixed" for sticky headers and
     * banners whose own box is too small to hold the button.
     */
    buttonPlacement?: 'inside' | 'inside-low' | 'fixed';
    children: React.ReactNode;
}
/**
 * CmsSection
 *
 * In normal visitor mode: renders children directly with zero overhead.
 * In CMS edit mode (?cms_edit_mode=1 inside the studio preview):
 *  - Adds an outline and a floating edit button on hover.
 *  - Listens for SCROLL_TO_SECTION from the studio to centre and pulse the section.
 *  - Clicking anywhere on the section tells the studio to open this section's form.
 *
 * The button is rendered on document.body and only while its section is the innermost one
 * under the mouse, so sticky headers, nested sections and overlapping page content can
 * neither cover it nor catch its clicks.
 */
declare const CmsSection: React.FC<CmsSectionProps>;

interface CmsFieldProps {
    /**
     * Where the value lives inside the section's content, in dot form:
     * "title", "image", "items.0.title". It can also point to a whole object or list ("items.0").
     */
    path: string;
    /** Name shown on the pencil button. Default: made from the path. */
    label?: string;
    children: React.ReactNode;
}
/**
 * CmsField
 *
 * Gives one value of a section its own pencil, so an editor can change just the title, the
 * image or the icon. Place it inside a <CmsSection>.
 *
 * Visitors get the children only, with no extra element. In the studio preview the wrapper uses
 * `display: contents`, so it does not affect the page layout.
 */
declare const CmsField: React.FC<CmsFieldProps>;

/** True when the current page is rendered inside the studio's preview iframe. */
declare function isCmsPreview(): boolean;
/**
 * Whether hover-to-edit is on. Starts from the `cms_edit_mode` URL flag and then
 * follows the studio's Edit/View toggle (SET_CMS_EDIT_MODE messages).
 */
declare function useCmsEditMode(origins: string[]): boolean;

export { CmsField, type CmsFieldProps, CmsProvider, type CmsProviderProps, CmsSection, type CmsSectionProps, isCmsPreview, useCmsConfig, useCmsEditMode, usePageContent };
