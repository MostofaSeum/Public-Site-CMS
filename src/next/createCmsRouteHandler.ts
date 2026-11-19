import type { CmsStorageAdapter } from '../core/types';
import { isValidKey } from '../core/defineCms';

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
}

type Handler = (request: Request) => Promise<Response>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

const error = (status: number, detail: string) => json({ detail }, status);

/** Path segments after the "records" or "media" keyword of the request URL. */
function parseRoute(request: Request): { resource: 'records' | 'media' | null; rest: string[] } {
  const segments = new URL(request.url).pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const index = segments.findIndex((s) => s === 'records' || s === 'media');
  if (index === -1) return { resource: null, rest: [] };
  return { resource: segments[index] as 'records' | 'media', rest: segments.slice(index + 1) };
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
