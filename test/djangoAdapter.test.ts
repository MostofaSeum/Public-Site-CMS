import { describe, expect, it } from 'vitest';
import { djangoAdapter } from '../src/adapters';

/** Fake Django: hands out tokens from /csrf and accepts only the latest one. */
function fakeDjango() {
  let current = 'token-1';
  const calls: { method: string; url: string; token: string | null; credentials?: RequestCredentials }[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const method = (init.method ?? 'GET').toUpperCase();
    const token = new Headers(init.headers).get('X-CSRFToken');
    calls.push({ method, url, token, credentials: init.credentials });

    if (url.endsWith('/csrf')) return Response.json({ csrfToken: current });
    if (method !== 'GET' && token !== current) return Response.json({ detail: 'CSRF' }, { status: 403 });
    if (method === 'PUT') {
      return Response.json({ page: 'home', sectionKey: 'hero', content: { a: 1 }, isPublished: true, updatedAt: null });
    }
    if (method === 'DELETE') return new Response(null, { status: 204 });
    return Response.json([]);
  }) as typeof fetch;
  return { fetchImpl, calls, rotate: () => (current = 'token-2') };
}

describe('djangoAdapter', () => {
  it('sends the CSRF token on writes only, fetching it once', async () => {
    const dj = fakeDjango();
    const adapter = djangoAdapter({ baseUrl: 'https://api.example.com/api/cms/', fetch: dj.fetchImpl });

    await adapter.listRecords('home');
    await adapter.saveRecord({ page: 'home', sectionKey: 'hero', content: { a: 1 }, isPublished: true });
    await adapter.deleteRecord('home', 'hero');

    expect(dj.calls.filter((c) => c.url.endsWith('/csrf'))).toHaveLength(1);
    expect(dj.calls.find((c) => c.method === 'GET' && c.url.includes('/records'))?.token).toBeNull();
    expect(dj.calls.filter((c) => c.method === 'PUT' || c.method === 'DELETE').every((c) => c.token === 'token-1')).toBe(true);
    expect(dj.calls.every((c) => c.credentials === 'include')).toBe(true);
  });

  it('refreshes a rejected token once and retries', async () => {
    const dj = fakeDjango();
    const adapter = djangoAdapter({ baseUrl: '/api/cms', fetch: dj.fetchImpl });
    await adapter.deleteRecord('home', 'hero'); // caches token-1
    dj.rotate(); // e.g. login rotated the token

    await expect(adapter.deleteRecord('home', 'hero')).resolves.toBeUndefined();
    const deletes = dj.calls.filter((c) => c.method === 'DELETE').map((c) => c.token);
    expect(deletes).toEqual(['token-1', 'token-1', 'token-2']);
  });
});
