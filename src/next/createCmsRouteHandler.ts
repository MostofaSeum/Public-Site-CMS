import type { CmsStorageAdapter, CollectionItemSummary } from '../core/types';
import { isValidKey } from '../core/defineCms';

/**
 * Loads and saves the records of one collection (blog posts, products...) with your own code,
 * for pages with a [slug] or [id] route. Every call is made only for authorised editors.
 */
export interface CmsCollectionHandler {
  /** Every record the studio may open: id, a name for the menu, and route params if needed. */
  list(request: Request): CollectionItemSummary[] | Promise<CollectionItemSummary[]>;
  /**
   * The editable values of one record, e.g. { title, summary, cover }, or null when it does not
   * exist. Only the keys returned here can be saved, and each keeps its type.
   */
  get(id: string, request: Request): Record<string, unknown> | null | undefined | Promise<Record<string, unknown> | null | undefined>;
  /**
   * Save the changed values (a subset of what `get` returned). Refresh any cache your pages use
   * here, e.g. revalidateTag("blog"). Return the saved values, or nothing to have `get` called again.
   */
  save(
    id: string,
    values: Record<string, unknown>,
    request: Request
  ): void | Record<string, unknown> | Promise<void | Record<string, unknown>>;
}

export interface CmsRouteHandlerOptions {
  /** Server-side storage, e.g. `fileStorage()` or your own database adapter. */
  storage: CmsStorageAdapter;
  /**
   * Return true when the request comes from a CMS editor (check your session or
   * token here). Required: writes, drafts and the media library are refused otherwise.
   */
  authorize: (request: Request) => boolean | Promise<boolean>;
  /** Name stored as "updated by" on saved records. */
  getUserName?: (request: Request) => string | null | Promise<string | null>;
  /** Restrict storage to these page keys (recommended: your config's page keys). */
  allowedPages?: string[];
  /** Largest accepted JSON body in bytes. Defaults to 1 MB. */
  maxBodyBytes?: number;
  /** Collections whose records the studio can edit, by the key used in a page's `collection`. */
  collections?: Record<string, CmsCollectionHandler>;
}

type Handler = (request: Request) => Promise<Response>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

const error = (status: number, detail: string) => json({ detail }, status);

type Resource = 'records' | 'media' | 'collections';
const RESOURCES = new Set<string>(['records', 'media', 'collections']);

/** Path segments after the "records", "media" or "collections" keyword of the request URL. */
function parseRoute(request: Request): { resource: Resource | null; rest: string[] } {
  let segments: string[];
  try {
    segments = new URL(request.url).pathname.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return { resource: null, rest: [] };
  }
  const index = segments.findIndex((s) => RESOURCES.has(s));
  if (index === -1) return { resource: null, rest: [] };
  return { resource: segments[index] as Resource, rest: segments.slice(index + 1) };
}

const kindOf = (value: unknown) => (value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value);

/**
 * Keeps only values the record already has, with the same type (null may become a string and
 * back). Returns an error message for anything else.
 */
export function pickEditableValues(
  current: Record<string, unknown>,
  incoming: unknown
): { values: Record<string, unknown> } | { error: string } {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return { error: "Field 'values' must be an object." };
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(incoming as Record<string, unknown>)) {
    if (!Object.prototype.hasOwnProperty.call(current, key)) return { error: `'${key}' cannot be edited.` };
    const was = kindOf(current[key]);
    const now = kindOf(value);
    const nullable = (was === 'null' && now === 'string') || (was === 'string' && now === 'null');
    if (was !== now && !nullable) return { error: `'${key}' must stay a ${was}.` };
    values[key] = value;
  }
  return { values };
}

/**
 * Next.js App Router handler implementing the CMS REST contract used by
 * `restAdapter`. Mount it on a catch-all route:
 *
 *   // app/api/cms/[...path]/route.ts
 *   export const { GET, PUT, DELETE, POST } = createCmsRouteHandler({ storage, authorize });
 *
 * It only uses the standard Request/Response API, so it also works in any
 * framework that speaks Fetch (Remix, Hono, Bun, Deno).
 */
export function createCmsRouteHandler(options: CmsRouteHandlerOptions): {
  GET: Handler;
  PUT: Handler;
  DELETE: Handler;
  POST: Handler;
} {
  const { storage, authorize } = options;
  if (typeof authorize !== 'function') {
    throw new Error('[storio-editor] createCmsRouteHandler needs an "authorize" function.');
  }
  const allowedPages = options.allowedPages ? new Set(options.allowedPages) : null;
  const maxBodyBytes = options.maxBodyBytes ?? 1024 * 1024;

  const checkKeys = (page: string, sectionKey?: string): Response | null => {
    if (!isValidKey(page) || (sectionKey !== undefined && !isValidKey(sectionKey))) {
      return error(400, 'Invalid page or section key.');
    }
    if (allowedPages && !allowedPages.has(page)) return error(404, `Unknown page '${page}'.`);
    return null;
  };

  const collections = options.collections ?? {};

  /** The handler for ".../collections/:key/items[/:id]", or the error response. */
  const findCollection = (rest: string[]): { handler: CmsCollectionHandler } | { response: Response } => {
    if ((rest.length !== 2 && rest.length !== 3) || rest[1] !== 'items') return { response: error(404, 'Not found.') };
    const [key] = rest;
    const handler = isValidKey(key) && Object.prototype.hasOwnProperty.call(collections, key) ? collections[key] : undefined;
    if (!handler) return { response: error(404, `Unknown collection '${key}'. Add it to "collections" of createCmsRouteHandler.`) };
    if (rest.length === 3 && (rest[2].length === 0 || rest[2].length > 200)) return { response: error(400, 'Invalid record id.') };
    return { handler };
  };

  const collectionFailure = (err: unknown) => {
    console.error('[storio-editor] collection handler failed', err);
    return error(500, 'The record could not be loaded or saved. See the server log.');
  };

  const readJson = async (request: Request): Promise<{ body: Record<string, unknown> } | { response: Response }> => {
    const length = Number(request.headers.get('content-length') ?? 0);
    if (length > maxBodyBytes) return { response: error(413, 'Content too large.') };
    try {
      const text = await request.text();
      if (text.length > maxBodyBytes) return { response: error(413, 'Content too large.') };
      const body = JSON.parse(text);
      return { body: body && typeof body === 'object' ? body : {} };
    } catch {
      return { response: error(400, 'Body must be JSON.') };
    }
  };

  const isAuthorized = async (request: Request) => {
    try {
      return Boolean(await authorize(request));
    } catch {
      return false;
    }
  };

  const GET: Handler = async (request) => {
    const { resource, rest } = parseRoute(request);
    const url = new URL(request.url);

    if (resource === 'media') {
      if (!(await isAuthorized(request))) return error(401, 'Not authorised.');
      if (!storage.listMedia) return json([]);
      return json(await storage.listMedia());
    }

    if (resource === 'collections') {
      if (!(await isAuthorized(request))) return error(401, 'Not authorised.');
      const found = findCollection(rest);
      if ('response' in found) return found.response;
      try {
        if (rest.length === 2) return json(await found.handler.list(request));
        const item = await found.handler.get(rest[2], request);
        return item ? json(item) : error(404, 'Record not found.');
      } catch (err) {
        return collectionFailure(err);
      }
    }

    if (resource !== 'records') return error(404, 'Not found.');
    // Drafts are only ever returned to authorised editors.
    const includeDrafts = url.searchParams.get('drafts') === '1' && (await isAuthorized(request));

    if (rest.length === 0) {
      const page = url.searchParams.get('page') ?? undefined;
      if (page) {
        const bad = checkKeys(page);
        if (bad) return bad;
      }
      const records = await storage.listRecords(page, { includeDrafts });
      return json(allowedPages ? records.filter((r) => allowedPages.has(r.page)) : records);
    }

    if (rest.length === 2) {
      const [page, sectionKey] = rest;
      const bad = checkKeys(page, sectionKey);
      if (bad) return bad;
      const record = await storage.getRecord(page, sectionKey, { includeDrafts });
      // null (not 404) for a section that was never edited: it is a normal state.
      return json(record ?? null);
    }

    return error(404, 'Not found.');
  };

  const PUT: Handler = async (request) => {
    const { resource, rest } = parseRoute(request);
    if (resource === 'collections') {
      if (!(await isAuthorized(request))) return error(401, 'Not authorised.');
      if (rest.length !== 3) return error(404, 'Not found.');
      const found = findCollection(rest);
      if ('response' in found) return found.response;
      const read = await readJson(request);
      if ('response' in read) return read.response;
      const id = rest[2];
      try {
        const current = await found.handler.get(id, request);
        if (!current) return error(404, 'Record not found.');
        const picked = pickEditableValues(current, read.body.values);
        if ('error' in picked) return error(400, picked.error);
        const saved = await found.handler.save(id, picked.values, request);
        return json(saved ?? (await found.handler.get(id, request)) ?? { ...current, ...picked.values });
      } catch (err) {
        return collectionFailure(err);
      }
    }
    if (resource !== 'records' || rest.length !== 2) return error(404, 'Not found.');
    if (!(await isAuthorized(request))) return error(401, 'Not authorised.');

    const [page, sectionKey] = rest;
    const bad = checkKeys(page, sectionKey);
    if (bad) return bad;

    const length = Number(request.headers.get('content-length') ?? 0);
    if (length > maxBodyBytes) return error(413, 'Content too large.');

    let body: { content?: unknown; isPublished?: unknown };
    try {
      const text = await request.text();
      if (text.length > maxBodyBytes) return error(413, 'Content too large.');
      body = JSON.parse(text);
    } catch {
      return error(400, 'Body must be JSON.');
    }
    if (body.content === undefined || body.content === null) {
      return error(400, "Field 'content' is required.");
    }

    const record = await storage.saveRecord({
      page,
      sectionKey,
      content: body.content,
      isPublished: body.isPublished !== false,
      updatedBy: options.getUserName ? await options.getUserName(request) : null,
    });
    return json(record);
  };

  const DELETE: Handler = async (request) => {
    const { resource, rest } = parseRoute(request);
    if (resource !== 'records' || rest.length !== 2) return error(404, 'Not found.');
    if (!(await isAuthorized(request))) return error(401, 'Not authorised.');

    const [page, sectionKey] = rest;
    const bad = checkKeys(page, sectionKey);
    if (bad) return bad;

    await storage.deleteRecord(page, sectionKey);
    return new Response(null, { status: 204 });
  };

  const POST: Handler = async (request) => {
    const { resource } = parseRoute(request);
    if (resource !== 'media') return error(404, 'Not found.');
    if (!(await isAuthorized(request))) return error(401, 'Not authorised.');
    if (!storage.uploadMedia) return error(501, 'Uploads are not enabled for this storage.');

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return error(400, 'Body must be multipart/form-data.');
    }
    const files = [...form.getAll('files'), ...form.getAll('file')].filter(
      (value): value is File => typeof value === 'object' && value !== null && 'arrayBuffer' in value
    );
    if (files.length === 0) return error(400, 'No files uploaded.');

    const items = await storage.uploadMedia(files);
    if (items.length === 0) {
      return error(400, 'No valid images. Upload JPG, PNG, WebP, SVG, GIF or AVIF files within the size limit.');
    }
    return json({ items }, 201);
  };

  return { GET, PUT, DELETE, POST };
}
