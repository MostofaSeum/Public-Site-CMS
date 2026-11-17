import { C as CmsStorageAdapter, S as SectionRecord } from './types-B7p5QrQp.js';
import 'react';

interface RestAdapterOptions {
    /** Base URL of the CMS API, e.g. "/api/cms" or "https://api.example.com/cms". */
    baseUrl: string;
    /** Extra request headers (for example an Authorization header), or a function returning them. */
    headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
    /** Fetch credentials mode. Defaults to "same-origin" so session cookies are sent. */
    credentials?: RequestCredentials;
    /** Set to false when the server does not implement the /media endpoints. */
    media?: boolean;
    /** Custom fetch implementation (tests, polyfills). */
    fetch?: typeof fetch;
}
/** Error thrown for non-2xx responses; carries the HTTP status. */
declare class CmsRequestError extends Error {
    readonly status: number;
    constructor(message: string, status: number);
}
/**
 * Adapter that talks to a CMS HTTP API. The contract (implemented by
 * `createCmsRouteHandler` and documented in the README):
 *
 *   GET    {base}/records?page=&drafts=1     -> SectionRecord[]
 *   GET    {base}/records/:page/:section     -> SectionRecord, or null when never edited
 *   PUT    {base}/records/:page/:section     body { content, isPublished } -> SectionRecord
 *   DELETE {base}/records/:page/:section     -> 204
 *   GET    {base}/media                      -> MediaItem[]
 *   POST   {base}/media                      multipart "files" -> { items: MediaItem[] }
 */
declare function restAdapter(options: RestAdapterOptions): CmsStorageAdapter;

interface DjangoAdapterOptions extends Omit<RestAdapterOptions, 'headers'> {
    /** Extra headers, e.g. an Authorization header if your AUTHORIZE check uses tokens. */
    headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);
}
/**
 * Adapter for the `django-visual-cms` package. Same API as `restAdapter`, plus
 * Django's CSRF handling: it fetches a token from `{baseUrl}/csrf`, sends it as
 * `X-CSRFToken` on writes, and refreshes it once if Django rejects it.
 *
 * Cookies are sent with every request (`credentials: "include"` by default) so
 * Django's session login identifies the editor, even on another domain.
 */
declare function djangoAdapter(options: DjangoAdapterOptions): CmsStorageAdapter;

/**
 * Keeps records in memory. Useful for demos, tests and as a reference for
 * writing your own adapter. Content is lost when the process or tab reloads.
 */
declare function memoryAdapter(initial?: SectionRecord[]): CmsStorageAdapter & {
    dump(): SectionRecord[];
};

export { CmsRequestError, type DjangoAdapterOptions, type RestAdapterOptions, djangoAdapter, memoryAdapter, restAdapter };
