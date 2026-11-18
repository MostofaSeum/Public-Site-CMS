import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CmsAuthError, cmsAuth, djangoAdapter } from '../src/adapters';
import { checkDjango, checkProductionApi, checkProductionFiles, checkProject, usesTokenAuth } from '../src/cli/doctor';
import { runInit } from '../src/cli/init';
import { CmsAuthGate, CmsLogin, CmsLogoutButton, safeNext } from '../src/admin/CmsAuth';

const BASE = 'https://api.example.com/api/cms';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
    removeItem: (k: string) => void delete data[k],
  };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const LOGIN_OK = { token: 'tok123', expiresIn: 3600, user: { username: 'editor', name: 'Eda Tor' } };

describe('cmsAuth', () => {
  it('logs in, stores the token and sends it as a Bearer header', async () => {
    const storage = memoryStorage();
    const fetchFn = vi.fn(async () => json(200, LOGIN_OK));
    const auth = cmsAuth({ baseUrl: `${BASE}/`, storage, fetch: fetchFn as unknown as typeof fetch });

    expect(auth.getToken()).toBeNull();
    expect(auth.headers()).toEqual({});
    const user = await auth.login('editor', 'pw');

    expect(user).toEqual({ username: 'editor', name: 'Eda Tor' });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/auth/login`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ username: 'editor', password: 'pw' });
    expect(auth.getToken()).toBe('tok123');
    expect(auth.headers()).toEqual({ Authorization: 'Bearer tok123' });
    expect(JSON.parse(storage.data['visual-cms-token']).token).toBe('tok123');

    // A new instance (page reload) finds the stored token.
    expect(cmsAuth({ baseUrl: BASE, storage }).getToken()).toBe('tok123');
    auth.logout();
    expect(auth.getToken()).toBeNull();
    expect(storage.data['visual-cms-token']).toBeUndefined();
  });

  it('forgets an expired token (a little early) and cleans the storage', async () => {
    vi.useFakeTimers();
    try {
      const storage = memoryStorage();
      const auth = cmsAuth({ baseUrl: BASE, storage, fetch: (async () => json(200, LOGIN_OK)) as unknown as typeof fetch });
      await auth.login('a', 'b');
      vi.advanceTimersByTime((3600 - 31) * 1000);
      expect(auth.getToken()).toBe('tok123');
      vi.advanceTimersByTime(2 * 1000);
      expect(auth.getToken()).toBeNull();
      expect(storage.data['visual-cms-token']).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores corrupt stored values', () => {
    for (const bad of ['not json', '{"token":1}', '{"token":"t","expiresAt":"x"}', 'null']) {
      const storage = memoryStorage({ 'visual-cms-token': bad });
      expect(cmsAuth({ baseUrl: BASE, storage }).getToken()).toBeNull();
    }
  });

  it('turns server errors into readable CmsAuthError messages', async () => {
    const make = (response: () => Promise<Response>) => cmsAuth({ baseUrl: BASE, storage: null, fetch: response as unknown as typeof fetch });
    await expect(make(async () => json(401, { detail: 'Invalid username or password.' })).login('a', 'b')).rejects.toMatchObject({ status: 401, message: 'Invalid username or password.' });
    await expect(make(async () => json(429, { detail: 'Too many failed attempts. Try again in a few minutes.' })).login('a', 'b')).rejects.toMatchObject({ status: 429 });
    await expect(make(async () => json(403, { detail: 'This account is not allowed to edit the site.' })).login('a', 'b')).rejects.toMatchObject({ status: 403 });
    await expect(make(async () => new Response('<html>', { status: 404 })).login('a', 'b')).rejects.toThrow(/update django-visual-cms/);
    await expect(make(async () => new Response('boom', { status: 500 })).login('a', 'b')).rejects.toThrow(/status 500/);
    const offline = make(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(offline.login('a', 'b')).rejects.toBeInstanceOf(CmsAuthError);
    await expect(offline.login('a', 'b')).rejects.toThrow(/Cannot reach the server/);
  });

  it('works without usable storage (keeps the token in memory)', async () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const auth = cmsAuth({ baseUrl: BASE, storage: throwing, fetch: (async () => json(200, LOGIN_OK)) as unknown as typeof fetch });
    await auth.login('a', 'b');
    expect(auth.getToken()).toBe('tok123');
    auth.logout();
    expect(auth.getToken()).toBeNull();
  });

  describe('check()', () => {
    it('returns the user and sends only the token, never cookies', async () => {
      const fetchFn = vi.fn(async () => json(200, { user: { username: 'editor', name: 'Eda Tor' } }));
      const auth = cmsAuth({ baseUrl: BASE, storage: memoryStorage({ 'visual-cms-token': JSON.stringify({ token: 'tk', expiresAt: Date.now() + 60_000 }) }), fetch: fetchFn as unknown as typeof fetch });
      expect(await auth.check()).toEqual({ username: 'editor', name: 'Eda Tor' });
      const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe(`${BASE}/auth/me`);
      expect(init.credentials).toBe('omit');
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tk');
    });

    it('is not signed in without a token, and does not even ask the server (a Django session cookie must not count)', async () => {
      const fetchFn = vi.fn(async () => json(200, { user: { username: 'admin', name: 'admin' } })); // what a staff session would get
      const auth = cmsAuth({ baseUrl: BASE, storage: memoryStorage(), fetch: fetchFn as unknown as typeof fetch });
      expect(await auth.check()).toBeNull();
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('returns null and forgets a rejected token', async () => {
      const storage = memoryStorage({ 'visual-cms-token': JSON.stringify({ token: 'old', expiresAt: Date.now() + 60_000 }) });
      const auth = cmsAuth({ baseUrl: BASE, storage, fetch: (async () => json(401, { detail: 'Not authorised.' })) as unknown as typeof fetch });
      expect(await auth.check()).toBeNull();
      expect(auth.getToken()).toBeNull();
      expect(storage.data['visual-cms-token']).toBeUndefined();
    });

    it('throws when the server is down, without forgetting the token', async () => {
      const storage = memoryStorage({ 'visual-cms-token': JSON.stringify({ token: 'tk', expiresAt: Date.now() + 60_000 }) });
      const broken = cmsAuth({ baseUrl: BASE, storage, fetch: (async () => new Response('x', { status: 502 })) as unknown as typeof fetch });
      await expect(broken.check()).rejects.toThrow(/status 502/);
      const offline = cmsAuth({
        baseUrl: BASE,
        storage,
        fetch: (async () => {
          throw new TypeError('offline');
        }) as unknown as typeof fetch,
      });
      await expect(offline.check()).rejects.toThrow();
      expect(offline.getToken()).toBe('tk');
    });
  });

  it('storage shortcuts: "session" and "local" use the browser storages, "memory" keeps nothing', async () => {
    const local = memoryStorage();
    const session = memoryStorage();
    const g = globalThis as unknown as { window?: unknown };
    const hadWindow = 'window' in g;
    const previous = g.window;
    g.window = { localStorage: local, sessionStorage: session };
    try {
      const ok = (async () => json(200, LOGIN_OK)) as unknown as typeof fetch;
      await cmsAuth({ baseUrl: BASE, storage: 'session', fetch: ok }).login('a', 'b');
      expect(session.data['visual-cms-token']).toBeDefined();
      expect(local.data['visual-cms-token']).toBeUndefined();
      await cmsAuth({ baseUrl: BASE, fetch: ok }).login('a', 'b'); // default: local
      expect(local.data['visual-cms-token']).toBeDefined();
      const local2 = memoryStorage();
      g.window = { localStorage: local2, sessionStorage: memoryStorage() };
      await cmsAuth({ baseUrl: BASE, storage: 'memory', fetch: ok }).login('a', 'b');
      expect(local2.data['visual-cms-token']).toBeUndefined();
    } finally {
      if (hadWindow) g.window = previous;
      else delete g.window;
    }
  });

  it('plugs into djangoAdapter: every request carries the token, even the CSRF fetch', async () => {
    const seen: { url: string; method: string; auth: string | null; csrf: string | null }[] = [];
    const fetchFn = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      seen.push({ url: String(input), method: (init.method ?? 'GET').toUpperCase(), auth: headers.get('Authorization'), csrf: headers.get('X-CSRFToken') });
      if (String(input).endsWith('/csrf')) return json(200, { csrfToken: 'csrf1' });
      return json(200, { page: 'home', sectionKey: 'hero', content: {}, isPublished: true });
    }) as unknown as typeof fetch;

    const auth = cmsAuth({ baseUrl: BASE, storage: memoryStorage({ 'visual-cms-token': JSON.stringify({ token: 'tk', expiresAt: Date.now() + 60_000 }) }) });
    const adapter = djangoAdapter({ baseUrl: BASE, headers: auth.headers, fetch: fetchFn });
    await adapter.saveRecord({ page: 'home', sectionKey: 'hero', content: { a: 1 }, isPublished: true });

    expect(seen.map((s) => `${s.method} ${s.url.replace(BASE, '')}`)).toEqual(['GET /csrf', 'PUT /records/home/hero']);
    expect(seen.every((s) => s.auth === 'Bearer tk')).toBe(true);
    expect(seen[1].csrf).toBe('csrf1');

    auth.logout(); // headers are read per request, so a signed-out editor sends no token
    seen.length = 0;
    await adapter.listRecords('home', { includeDrafts: true });
    expect(seen[0].auth).toBeNull();
  });
});

describe('sign-in components', () => {
  const auth = cmsAuth({ baseUrl: BASE, storage: null });

  it('safeNext only allows same-site paths', () => {
    expect(safeNext('/admin/cms?x=1')).toBe('/admin/cms?x=1');
    for (const bad of ['//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)', '', null, undefined]) expect(safeNext(bad as string)).toBeNull();
  });

  it('CmsLogin renders a username and password form', () => {
    const html = renderToStaticMarkup(React.createElement(CmsLogin, { auth, title: 'Admin sign in' }));
    expect(html).toContain('Admin sign in');
    expect(html).toMatch(/autocomplete="username"/i);
    expect(html).toMatch(/type="password"/);
    expect(html).toContain('Sign in');
  });

  it('CmsAuthGate shows a spinner first and never renders its children before the check', () => {
    const html = renderToStaticMarkup(React.createElement(CmsAuthGate, { auth }, React.createElement('p', null, 'SECRET CMS')));
    expect(html).not.toContain('SECRET CMS');
    expect(html).toContain('Checking your sign-in');
  });

  it('CmsLogoutButton renders its label', () => {
    expect(renderToStaticMarkup(React.createElement(CmsLogoutButton, { auth }))).toContain('Sign out');
    expect(renderToStaticMarkup(React.createElement(CmsLogoutButton, { auth }, 'Log out'))).toContain('Log out');
  });
});

describe('init and doctor with the token login', () => {
  const make = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-cms-tokenauth-'));
    fs.mkdirSync(path.join(dir, 'app'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ dependencies: { next: '15.5.0', tailwindcss: '^4' } }));
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), '{ "compilerOptions": { "paths": { "@/*": ["./*"] } } }');
    fs.writeFileSync(path.join(dir, 'app', 'layout.tsx'), 'export default function L({ children }: { children: React.ReactNode }) {\n  return (\n    <html>\n      <body>{children}</body>\n    </html>\n  );\n}\n');
    fs.writeFileSync(path.join(dir, 'app', 'globals.css'), '@import "tailwindcss";\n');
    return dir;
  };
  const init = (dir: string, over: Record<string, unknown> = {}) =>
    runInit({ cwd: dir, backend: 'django', apiUrl: 'http://localhost:8000/api/cms', adminPath: 'admin/cms', example: false, install: false, dryRun: false, force: false, ...over });
  const read = (dir: string, ...p: string[]) => fs.readFileSync(path.join(dir, ...p), 'utf8');
  const cleanup = (dir: string) => fs.rmSync(dir, { recursive: true, force: true });

  it('generates the sign-in setup by default for Django', () => {
    const dir = make();
    init(dir);
    const config = read(dir, 'cms.config.ts');
    expect(config).toContain("import { cmsAuth, djangoAdapter } from '@brainicon/visual-cms/adapters';");
    expect(config).toContain('export const cmsLogin = cmsAuth({ baseUrl: API_URL });');
    expect(config).toContain('djangoAdapter({ baseUrl: API_URL, headers: cmsLogin.headers })');
    const page = read(dir, 'app', 'admin', 'cms', 'page.tsx');
    expect(page).toContain('<CmsAuthGate auth={cmsLogin}>');
    expect(page).toContain("import { cms, cmsLogin } from '@/cms.config';");
    expect(usesTokenAuth(dir)).toBe(true);
    cleanup(dir);
  });

  it("--auth session keeps Django's own login and an unguarded screen", () => {
    const dir = make();
    init(dir, { auth: 'session' });
    expect(read(dir, 'cms.config.ts')).not.toContain('cmsAuth');
    expect(read(dir, 'app', 'admin', 'cms', 'page.tsx')).not.toContain('CmsAuthGate');
    expect(usesTokenAuth(dir)).toBe(false);
    cleanup(dir);
  });

  it('the files backend never gets the token login', () => {
    const dir = make();
    init(dir, { backend: 'files', apiUrl: '' });
    expect(read(dir, 'cms.config.ts')).not.toContain('cmsAuth');
    expect(read(dir, 'app', 'admin', 'cms', 'page.tsx')).not.toContain('CmsAuthGate');
    cleanup(dir);
  });

  it('doctor reads the API URL from the generated config and passes the production file checks', () => {
    const dir = make();
    init(dir);
    const local = checkProject(dir);
    expect(local.djangoBaseUrl).toBe('http://localhost:8000/api/cms');
    expect(local.checks.some((c) => c.title.includes('token login'))).toBe(true);
    const prod = checkProductionFiles(dir);
    expect(prod.filter((c) => c.level === 'fail')).toEqual([]);
    expect(prod.some((c) => c.title === 'The API URL comes from an environment variable')).toBe(true);
    cleanup(dir);
  });

  const reply = (status: number, headers: Record<string, string> = {}) => ({ status, headers: { get: (n: string) => headers[n.toLowerCase()] ?? null }, text: async () => '' });
  const cors = { 'access-control-allow-origin': 'http://localhost:3000', 'access-control-allow-credentials': 'true' };
  const levels = (checks: { level: string; title: string }[]) => checks.map((c) => `${c.level}:${c.title}`).join('\n');

  it('doctor checks the Authorization header and the token endpoint', async () => {
    const good = await checkDjango(
      'http://api/x',
      'http://localhost:3000',
      async (url, init) => {
        if (init?.method === 'OPTIONS') return reply(200, { ...cors, 'access-control-allow-methods': 'PUT', 'access-control-allow-headers': 'content-type, x-csrftoken, authorization' });
        return url.endsWith('/auth/me') ? reply(401) : reply(200, cors);
      },
      { tokenAuth: true }
    );
    expect(levels(good)).toContain('ok:Saving is allowed by CORS (PUT + X-CSRFToken + Authorization)');
    expect(levels(good)).toContain('ok:Token login is available on the server');

    const blocked = await checkDjango(
      'http://api/x',
      'http://localhost:3000',
      async (url, init) => {
        if (init?.method === 'OPTIONS') return reply(200, { ...cors, 'access-control-allow-methods': 'PUT', 'access-control-allow-headers': 'content-type, x-csrftoken' });
        return url.endsWith('/auth/me') ? reply(404) : reply(200, cors);
      },
      { tokenAuth: true }
    );
    expect(levels(blocked)).toContain('fail:CORS does not allow the Authorization header');
    expect(levels(blocked)).toContain('fail:The server has no token login');

    // Session projects are not asked about the token endpoint.
    const session = await checkDjango('http://api/x', 'http://localhost:3000', async () => reply(200, cors));
    expect(levels(session)).not.toContain('Token login');
  });

  it('production: different sites are fine with the token login, a failure without it', async () => {
    const fetchFn = async (url: string) =>
      url.endsWith('/csrf')
        ? reply(200, { 'access-control-allow-origin': 'https://mysite.vercel.app', 'access-control-allow-credentials': 'true', 'set-cookie': 'csrftoken=a; Path=/; SameSite=Lax; Secure' })
        : reply(404);
    const token = await checkProductionApi('https://myapi.herokuapp.com/api/cms', 'https://mysite.vercel.app', fetchFn, { tokenAuth: true });
    expect(token.filter((c) => c.level === 'fail')).toEqual([]);
    expect(levels(token)).toContain('different sites, which is fine');
    const cookie = await checkProductionApi('https://myapi.herokuapp.com/api/cms', 'https://mysite.vercel.app', fetchFn);
    expect(levels(cookie)).toContain('fail:The site (vercel.app) and the API (herokuapp.com) are different sites');
  });
});
