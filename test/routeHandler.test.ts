import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { memoryAdapter, restAdapter } from '../src/adapters';
import { createCmsRouteHandler, fileStorage, buildPageMetadata, isCmsPreviewRequest } from '../src/next';
import type { CmsStorageAdapter } from '../src/index';

/** restAdapter wired straight to the route handler, no network. */
function connect(storage: CmsStorageAdapter, opts: { authorized: boolean; allowedPages?: string[] }) {
  const handler = createCmsRouteHandler({
    storage,
    authorize: () => opts.authorized,
    getUserName: () => 'editor',
    allowedPages: opts.allowedPages,
  });
  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(new URL(String(input), 'http://localhost'), init);
    const method = request.method as 'GET' | 'PUT' | 'DELETE' | 'POST';
    return handler[method](request);
  }) as typeof fetch;
  return restAdapter({ baseUrl: '/api/cms', fetch: fakeFetch });
}

describe('restAdapter <-> createCmsRouteHandler', () => {
  it('saves, reads, hides drafts from visitors and resets', async () => {
    const storage = memoryAdapter();
    const editor = connect(storage, { authorized: true });
    const visitor = connect(storage, { authorized: false });

    const saved = await editor.saveRecord({ page: 'home', sectionKey: 'hero', content: { title: 'Hi' }, isPublished: false });
    expect(saved).toMatchObject({ page: 'home', sectionKey: 'hero', isPublished: false, updatedBy: 'editor' });

    // Drafts: visible to the editor only, and only when asked for.
    expect(await editor.listRecords('home', { includeDrafts: true })).toHaveLength(1);
    expect(await editor.listRecords('home')).toHaveLength(0);
    expect(await visitor.listRecords('home', { includeDrafts: true })).toHaveLength(0);
    expect(await visitor.getRecord('home', 'hero', { includeDrafts: true })).toBeNull();

    await editor.saveRecord({ page: 'home', sectionKey: 'hero', content: { title: 'Live' }, isPublished: true });
    expect(await visitor.getRecord('home', 'hero')).toMatchObject({ content: { title: 'Live' } });

    await editor.deleteRecord('home', 'hero');
    expect(await editor.getRecord('home', 'hero', { includeDrafts: true })).toBeNull();
  });

  it('refuses writes from unauthorised requests', async () => {
    const visitor = connect(memoryAdapter(), { authorized: false });
    await expect(
      visitor.saveRecord({ page: 'home', sectionKey: 'hero', content: {}, isPublished: true })
    ).rejects.toMatchObject({ status: 401 });
    await expect(visitor.deleteRecord('home', 'hero')).rejects.toMatchObject({ status: 401 });
    await expect(visitor.listMedia!()).rejects.toMatchObject({ status: 401 });
  });

  it('rejects malformed keys and pages outside allowedPages', async () => {
    const editor = connect(memoryAdapter(), { authorized: true, allowedPages: ['home'] });
    await expect(
      editor.saveRecord({ page: 'blog', sectionKey: 'hero', content: {}, isPublished: true })
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      editor.saveRecord({ page: 'bad key!', sectionKey: 'hero', content: {}, isPublished: true })
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('fileStorage', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'visual-cms-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('persists records across instances and survives concurrent saves', async () => {
    const opts = { dir: path.join(dir, 'data'), mediaDir: path.join(dir, 'media') };
    const a = fileStorage(opts);
    await Promise.all(
      ['one', 'two', 'three', 'four'].map((key) =>
        a.saveRecord({ page: 'home', sectionKey: key, content: { key }, isPublished: true })
      )
    );
    const b = fileStorage(opts);
    expect((await b.listRecords('home')).map((r) => r.sectionKey).sort()).toEqual(['four', 'one', 'three', 'two']);
    await b.deleteRecord('home', 'one');
    expect(await a.getRecord('home', 'one')).toBeNull();
    expect(JSON.parse(await readFile(path.join(dir, 'data', 'content.json'), 'utf8')).records).toHaveLength(3);
  });

  it('stores allowed images under a safe name and skips other files', async () => {
    const storage = fileStorage({ dir, mediaDir: path.join(dir, 'media'), mediaUrlPrefix: '/u' });
    const items = await storage.uploadMedia!([
      new File(['png'], '../../evil name.png', { type: 'image/png' }),
      new File(['x'], 'script.html', { type: 'text/html' }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].url).toMatch(/^\/u\/[0-9a-f]{8}_evil_name\.png$/);
    expect(await storage.listMedia!()).toHaveLength(1);
  });
});

describe('next helpers', () => {
  it('builds metadata from the seo section and handles noindex', () => {
    const meta = buildPageMetadata(
      { seo: { title: 'T', description: 'D', keywords: 'a, b', robots: 'noindex, follow' } },
      { title: 'Fallback' }
    );
    expect(meta).toMatchObject({ title: 'T', description: 'D', keywords: ['a', 'b'], robots: { index: false, follow: true } });
    expect(buildPageMetadata({}, { title: 'Fallback' })).toEqual({ title: 'Fallback' });
  });

  it('detects preview requests', () => {
    const req = (url: string, headers: Record<string, string> = {}) => ({ url, headers: new Headers(headers) });
    expect(isCmsPreviewRequest(req('http://x/?cms_preview=1'))).toBe(true);
    expect(isCmsPreviewRequest(req('http://x/', { 'sec-fetch-dest': 'iframe' }))).toBe(true);
    expect(isCmsPreviewRequest(req('http://x/', { referer: 'http://x/admin/cms?page=home' }), { studioPath: '/admin/cms' })).toBe(true);
    expect(isCmsPreviewRequest(req('http://x/', { referer: 'http://x/blog' }), { studioPath: '/admin/cms' })).toBe(false);
  });
});
