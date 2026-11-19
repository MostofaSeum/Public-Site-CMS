import { describe, expect, it } from 'vitest';
import { memoryAdapter, restAdapter } from '../src/adapters';
import { createCmsRouteHandler, type CmsCollectionHandler } from '../src/next';
import { pickEditableValues } from '../src/next/createCmsRouteHandler';
import { defineCms, fillRoute, groupPageOf, isDynamicRoute, recordPagesOf, topLevelPages } from '../src/index';
import type { PageDef } from '../src/index';

const page = (over: Partial<PageDef>): PageDef => ({ key: 'x', title: 'X', route: '/x', sections: [], defaults: {}, ...over });

const config = () =>
  defineCms({
    adapter: memoryAdapter(),
    pages: [
      page({ key: 'home', title: 'Home', route: '/' }),
      page({ key: 'blog', title: 'Blog', route: '/blog' }),
      page({ key: 'blog-post', title: 'Blog post', route: '/blog/[slug]', collection: 'blog', parent: 'blog' }),
      page({ key: 'product', title: 'Products', route: '/products/[slug]', collection: 'products' }),
    ],
  });

describe('collection pages', () => {
  it('fills the route of a record', () => {
    expect(fillRoute('/blog/[slug]', { id: 'school' })).toBe('/blog/school');
    expect(fillRoute('/shop/[category]/[id]', { id: '7', params: { category: 'shoes' } })).toBe('/shop/shoes/7');
    expect(fillRoute('/blog/[slug]', { id: 'a b/c' })).toBe('/blog/a%20b%2Fc');
    expect(isDynamicRoute('/blog/[slug]')).toBe(true);
    expect(isDynamicRoute('/blog')).toBe(false);
  });

  it('lists child pages under their parent and keeps record-only pages in the page menu', () => {
    const cfg = config();
    expect(topLevelPages(cfg).map((p) => p.key)).toEqual(['home', 'blog', 'product']);
    const post = cfg.pages.find((p) => p.key === 'blog-post') as PageDef;
    expect(groupPageOf(cfg, post).key).toBe('blog');
    expect(recordPagesOf(cfg, groupPageOf(cfg, post)).map((p) => p.key)).toEqual(['blog-post']);
    const product = cfg.pages.find((p) => p.key === 'product') as PageDef;
    expect(recordPagesOf(cfg, product).map((p) => p.key)).toEqual(['product']);
    expect(recordPagesOf(cfg, cfg.pages[0])).toEqual([]);
  });

  it('rejects a [slug] route without a collection and a broken parent', () => {
    const adapter = memoryAdapter();
    expect(() => defineCms({ adapter, pages: [page({ key: 'p', route: '/blog/[slug]' })] })).toThrow(/collection/);
    expect(() => defineCms({ adapter, pages: [page({ key: 'p', parent: 'nope', collection: 'c' })] })).toThrow(/not a page/);
    expect(() => defineCms({ adapter, pages: [page({ key: 'a' }), page({ key: 'b', parent: 'a' })] })).toThrow(/must show records/);
  });
});

describe('pickEditableValues', () => {
  const current = { title: 'School', cover: null, views: 3, tags: ['a'] };

  it('keeps known keys of the same type', () => {
    expect(pickEditableValues(current, { title: 'Schools', cover: '/x.jpg' })).toEqual({ values: { title: 'Schools', cover: '/x.jpg' } });
  });

  it('rejects unknown keys, changed types and non-objects', () => {
    expect(pickEditableValues(current, { status: 'draft' })).toEqual({ error: "'status' cannot be edited." });
    expect(pickEditableValues(current, { views: '3' })).toEqual({ error: "'views' must stay a number." });
    expect(pickEditableValues(current, { tags: 'a' })).toEqual({ error: "'tags' must stay a array." });
    expect(pickEditableValues(current, ['x'])).toHaveProperty('error');
    expect(pickEditableValues(current, { __proto__: { title: 'x' } })).toEqual({ values: {} });
  });
});

/** restAdapter wired straight to the route handler with one collection, no network. */
function connect(authorized: boolean) {
  const rows: Record<string, { title: string; summary: string; status: string }> = {
    school: { title: 'School', summary: 'About schools', status: 'published' },
    college: { title: 'College', summary: 'About colleges', status: 'published' },
  };
  const saves: string[] = [];
  const blog: CmsCollectionHandler = {
    list: () => Object.entries(rows).map(([id, row]) => ({ id, label: row.title })),
    get: (id) => (rows[id] ? { title: rows[id].title, summary: rows[id].summary } : null),
    save: (id, values) => {
      Object.assign(rows[id], values);
      saves.push(id);
    },
  };
  const handler = createCmsRouteHandler({ storage: memoryAdapter(), authorize: () => authorized, collections: { blog } });
  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(new URL(String(input), 'http://localhost'), init);
    return handler[request.method as 'GET' | 'PUT'](request);
  }) as typeof fetch;
  return { adapter: restAdapter({ baseUrl: '/api/cms', fetch: fakeFetch }), rows, saves };
}

describe('restAdapter <-> createCmsRouteHandler collections', () => {
  it('lists, reads and saves one record without touching the others', async () => {
    const { adapter, rows, saves } = connect(true);
    expect(await adapter.listItems!('blog')).toEqual([
      { id: 'school', label: 'School' },
      { id: 'college', label: 'College' },
    ]);
    expect(await adapter.getItem!('blog', 'school')).toEqual({ title: 'School', summary: 'About schools' });
    expect(await adapter.saveItem!('blog', 'school', { title: 'Best Schools' })).toEqual({ title: 'Best Schools', summary: 'About schools' });
    expect(rows.school.title).toBe('Best Schools');
    expect(rows.college.title).toBe('College');
    expect(saves).toEqual(['school']);
  });

  it('refuses fields the record does not expose, missing records and unknown collections', async () => {
    const { adapter, rows } = connect(true);
    await expect(adapter.saveItem!('blog', 'school', { status: 'draft' })).rejects.toMatchObject({ status: 400 });
    expect(rows.school.status).toBe('published');
    expect(await adapter.getItem!('blog', 'missing')).toBeNull();
    await expect(adapter.saveItem!('blog', 'missing', { title: 'x' })).rejects.toMatchObject({ status: 404 });
    await expect(adapter.listItems!('nope')).rejects.toMatchObject({ status: 404 });
  });

  it('keeps every collection call for editors only', async () => {
    const { adapter, rows } = connect(false);
    await expect(adapter.listItems!('blog')).rejects.toMatchObject({ status: 401 });
    await expect(adapter.getItem!('blog', 'school')).rejects.toMatchObject({ status: 401 });
    await expect(adapter.saveItem!('blog', 'school', { title: 'Hacked' })).rejects.toMatchObject({ status: 401 });
    expect(rows.school.title).toBe('School');
  });
});
