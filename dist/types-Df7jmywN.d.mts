import { ComponentType } from 'react';

/** Any icon component that accepts a className (lucide-react icons fit). */
type IconComponent = ComponentType<{
    className?: string;
}>;
/** One editable block of a page, e.g. "hero" or "faq". */
interface SectionDef {
    /** Key of this section inside the page's content object. */
    key: string;
    /** Human-readable label shown in the studio. */
    label: string;
    icon?: IconComponent;
    /**
     * Optional normaliser applied to the section data before it is loaded into the
     * form (for example to fill in fields older saved content does not have).
     */
    transform?: (data: unknown) => unknown;
}
/** A public page the CMS can edit. */
interface PageDef {
    /** Stable key used for storage, e.g. "home". Letters, digits, "_" and "-" only. */
    key: string;
    /** Title shown in the studio. */
    title: string;
    /** Public route rendered in the preview iframe, e.g. "/" or "/pricing". */
    route: string;
    icon?: IconComponent;
    /** Editable sections, in the order they appear in the studio. */
    sections: SectionDef[];
    /**
     * Default content for the page, keyed by section key. Saved overrides replace a
     * section as a whole; anything never edited keeps these values.
     */
    defaults: Record<string, unknown>;
}
/** A saved override for one section. Storage only ever holds overrides. */
interface SectionRecord {
    page: string;
    sectionKey: string;
    content: unknown;
    isPublished: boolean;
    updatedAt: string | null;
    updatedBy?: string | null;
}
interface SaveRecordInput {
    page: string;
    sectionKey: string;
    content: unknown;
    isPublished: boolean;
    updatedBy?: string | null;
}
interface ListOptions {
    /** Include unpublished (draft) records. Servers honour this only for authorised users. */
    includeDrafts?: boolean;
}
interface MediaItem {
    url: string;
    name: string;
    size?: number;
}
/**
 * Storage contract. Implement this to keep content anywhere (REST API, database,
 * files, memory). The studio and the public-site hooks talk only to this interface.
 */
interface CmsStorageAdapter {
    listRecords(page?: string, options?: ListOptions): Promise<SectionRecord[]>;
    getRecord(page: string, sectionKey: string, options?: ListOptions): Promise<SectionRecord | null>;
    saveRecord(input: SaveRecordInput): Promise<SectionRecord>;
    /** Remove an override, so the section falls back to its default ("Reset"). */
    deleteRecord(page: string, sectionKey: string): Promise<void>;
    /** Optional: enables the upload tab of the image picker. */
    uploadMedia?(files: File[]): Promise<MediaItem[]>;
    /** Optional: enables the media-library tab of the image picker. */
    listMedia?(): Promise<MediaItem[]>;
}
/** Cap on how many items an array field may hold, to protect a layout. */
interface CollectionLimit {
    max: number;
    label: string;
}
/** A ready-made image offered in the image picker's gallery. */
interface ImagePreset {
    url: string;
    title: string;
    category: string;
    tag?: string;
}
interface ImagePresetCategory {
    id: string;
    label: string;
}
/** Value edited by a code widget: an HTML/CSS/JS triple. */
interface CodeValue {
    html: string;
    css: string;
    js: string;
}
interface CodeWidgetProps {
    value: CodeValue;
    onChange: (value: CodeValue) => void;
}
interface CmsWidgets {
    /**
     * Editor used for objects shaped like `{ html, css, js }`. Without it those
     * fields are edited as plain text areas.
     */
    code?: ComponentType<CodeWidgetProps>;
}
interface CmsConfig {
    /** Pages the studio lists and the site can read. */
    pages: PageDef[];
    /** Where content is read from and saved to. */
    adapter: CmsStorageAdapter;
    /** Heading shown at the top of the studio. */
    title?: string;
    /**
     * Base URL of the public site when the studio runs on a different origin
     * (for example admin.example.com editing example.com). Defaults to the studio's origin.
     */
    publicSiteUrl?: string;
    /** Extra origins allowed to exchange preview messages with the studio. */
    allowedOrigins?: string[];
    /**
     * Item limits for array fields. Keys are tried in this order:
     * "page.section.path", "page.path", "section.path", "page.section".
     */
    collectionLimits?: Record<string, CollectionLimit>;
    imagePresets?: ImagePreset[];
    imagePresetCategories?: ImagePresetCategory[];
    widgets?: CmsWidgets;
}

export type { CmsConfig as C };
