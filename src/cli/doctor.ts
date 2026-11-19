import fs from 'node:fs';
import path from 'node:path';

export type CheckLevel = 'ok' | 'warn' | 'fail';
export interface Check {
  level: CheckLevel;
  title: string;
  /** What to do, for warn and fail. */
  fix?: string;
}

const exists = (p: string) => fs.existsSync(p);
const read = (p: string) => fs.readFileSync(p, 'utf8');
const LIB = '@brainicon/storio-elements-editor';

function walk(dir: string, match: (file: string) => boolean, out: string[] = [], depth = 0): string[] {
  if (depth > 6) return out;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, match, out, depth + 1);
    else if (match(p)) out.push(p);
  }
  return out;
}

export interface LocalFindings {
  checks: Check[];
  /** Base URL of the Django API when the config uses djangoAdapter. */
  djangoBaseUrl: string | null;
}

/** Checks that need only the project's files. */
export function checkProject(root: string): LocalFindings {
  const checks: Check[] = [];
  const add = (level: CheckLevel, title: string, fix?: string) => checks.push({ level, title, fix });

  const pkgPath = path.join(root, 'package.json');
  if (!exists(pkgPath)) {
    add('fail', 'No package.json here', 'Run this from the root of your Next.js project (or pass --cwd).');
    return { checks, djangoBaseUrl: null };
  }
  const pkg = JSON.parse(read(pkgPath)) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  const deps = { ...pkg.devDependencies, ...pkg.dependencies };

  add(deps.next ? 'ok' : 'fail', deps.next ? `Next.js ${deps.next}` : 'Next.js is not installed', deps.next ? undefined : 'This library needs a Next.js (App Router) project.');
  for (const dep of [LIB, 'react-hot-toast', 'lucide-react']) {
    add(deps[dep] ? 'ok' : 'fail', deps[dep] ? `${dep} installed` : `${dep} is missing`, deps[dep] ? undefined : `Run:  npm install ${dep === LIB ? '<path to the .tgz>' : dep}`);
  }

  const tw = deps.tailwindcss?.match(/\d+/)?.[0];
  if (!tw) add('fail', 'Tailwind CSS is not installed', 'The CMS screens are styled with Tailwind v4:  npm install tailwindcss @tailwindcss/postcss');
  else if (Number(tw) < 4) add('fail', `Tailwind CSS v${tw} found`, 'The CMS screens need Tailwind v4.');
  else add('ok', `Tailwind CSS v${tw}`);

  const srcApp = path.join(root, 'src', 'app');
  const appDir = exists(srcApp) ? srcApp : exists(path.join(root, 'app')) ? path.join(root, 'app') : null;
  if (!appDir) {
    add('fail', 'No app/ folder (App Router) found', 'The init command and the CMS helpers need the Next.js App Router.');
    return { checks, djangoBaseUrl: null };
  }
  const base = appDir === srcApp ? path.join(root, 'src') : root;

  // Tailwind must scan the library, or the CMS screen is unstyled.
  const css = walk(appDir, (f) => f.endsWith('.css')).concat(walk(base, (f) => /globals?\.css$/.test(f)));
  const withSource = css.find((f) => /@source[^;\n]*storio-elements-editor/.test(read(f)));
  add(
    withSource ? 'ok' : 'fail',
    withSource ? 'Tailwind scans the library (@source line)' : 'Tailwind does not scan the library',
    withSource ? undefined : 'Add to your global CSS, below @import "tailwindcss":   @source "../node_modules/@brainicon/storio-elements-editor/dist";   (the path is relative to that CSS file)'
  );

  const config = [path.join(base, 'cms.config.ts'), path.join(root, 'cms.config.ts')].find(exists);
  let djangoBaseUrl: string | null = null;
  if (!config) add('fail', 'cms.config.ts not found', 'Run:  npx storio-editor init');
  else {
    add('ok', `Config found (${path.relative(root, config).split(path.sep).join('/')})`);
    const text = read(config);
    // baseUrl: '...'  or  baseUrl: process.env.NEXT_PUBLIC_CMS_API_URL ?? '...'
    djangoBaseUrl = /djangoAdapter\(/.test(text)
      ? text.match(/(?:baseUrl:|\bAPI_URL\s*=)\s*(?:process\.env\.\w+\s*\?\?\s*)?['"`]([^'"`]+)['"`]/)?.[1] ?? null
      : null;
    if (/\bcmsAuth\(/.test(text)) add('ok', 'Editors sign in with the token login (cmsAuth)');
    if (!/\bkey:\s*['"]/.test(text)) add('warn', 'No pages are listed in cms.config.ts yet', 'Add one with:  npx storio-editor add-page <name>');
  }

  const sources = walk(appDir, (f) => /\.(tsx|jsx|ts|js)$/.test(f)).concat(walk(path.join(base, 'components'), (f) => /\.(tsx|jsx)$/.test(f)));
  const has = (re: RegExp) => sources.find((f) => re.test(read(f)));
  add(has(/<CmsProvider\b/) ? 'ok' : 'fail', has(/<CmsProvider\b/) ? 'CmsProvider wraps the app' : 'CmsProvider is not used', has(/<CmsProvider\b/) ? undefined : 'Wrap {children} in your root layout with <CmsProviders> (init creates components/CmsProviders.tsx).');
  const studio = has(/<CmsStudio\b/);
  add(studio ? 'ok' : 'fail', studio ? `CMS screen found (${path.relative(root, studio).split(path.sep).join('/')})` : 'No CMS screen found', studio ? undefined : 'Create a page that renders <CmsStudio config={cms} /> (init creates app/admin/cms/page.tsx).');
  if (!has(/<CmsSection\b/)) add('warn', 'No page uses <CmsSection> yet, so nothing shows a pencil button', 'Wrap an editable block:  <CmsSection sectionKey="hero" title="Hero">…</CmsSection>');

  return { checks, djangoBaseUrl };
}

type Fetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string> }
) => Promise<{ status: number; headers: { get(name: string): string | null }; text?: () => Promise<string> }>;

/** "example.com" for "https://api.example.com" (last two labels: good enough to tell sites apart). */
export function siteOf(url: string): string {
  const host = new URL(url).hostname;
  if (/^[\d.]+$/.test(host) || host === 'localhost') return host;
  return host.split('.').slice(-2).join('.');
}

/** Does cms.config use the token login (cmsAuth)? */
export function usesTokenAuth(root: string): boolean {
  const srcApp = path.join(root, 'src', 'app');
  const base = exists(srcApp) ? path.join(root, 'src') : root;
  const config = [path.join(base, 'cms.config.ts'), path.join(root, 'cms.config.ts')].find(exists);
  return config ? /cmsAuth\(/.test(read(config)) : false;
}

/** Project files that matter only for production. */
export function checkProductionFiles(root: string): Check[] {
  const checks: Check[] = [];
  const add = (level: CheckLevel, title: string, fix?: string) => checks.push({ level, title, fix });
  const srcApp = path.join(root, 'src', 'app');
  const base = exists(srcApp) ? path.join(root, 'src') : root;
  const appDir = exists(srcApp) ? srcApp : path.join(root, 'app');

  const config = [path.join(base, 'cms.config.ts'), path.join(root, 'cms.config.ts')].find(exists);
  const configText = config ? read(config) : '';
  if (/djangoAdapter\(/.test(configText)) {
    // `const API_URL = process.env.X ?? '...'` (generated by init) or `baseUrl: ...` directly.
    const expression = configText.match(/\bAPI_URL\s*=\s*[^\n]+/)?.[0] ?? configText.match(/baseUrl:[^\n]+/)?.[0] ?? '';
    const literal = expression.match(/['"`]([^'"`]+)['"`]/)?.[1] ?? '';
    if (/process\.env\./.test(expression)) add('ok', 'The API URL comes from an environment variable');
    else if (/localhost|127\.0\.0\.1/.test(literal)) add('fail', `The API URL is hardcoded to ${literal}`, "Use baseUrl: process.env.NEXT_PUBLIC_CMS_API_URL ?? '<dev URL>' in cms.config.ts and set the variable in production.");
    else add('ok', `The API URL is ${literal}`);
  }

  const storage = path.join(base, 'lib', 'cms-storage.ts');
  if (exists(storage) && /fileStorage\(/.test(read(storage))) {
    add('warn', 'Content is stored in a JSON file (file backend)', 'Fine on one server with a persistent disk. On serverless or several servers (Vercel, Netlify, autoscaling) edits get lost: use Django or a database adapter.');
  }
  const route = path.join(appDir, 'api', 'cms', '[...path]', 'route.ts');
  if (exists(route) && /NODE_ENV\s*===\s*['"]development['"]/.test(read(route))) {
    add('fail', 'Saving is only allowed under `next dev` (generated authorize())', `Replace authorize() in ${path.relative(root, route).split(path.sep).join('/')} with your real login check, or editors cannot save in production.`);
  }

  const providers = [path.join(base, 'components', 'CmsProviders.tsx')].find(exists);
  if (providers && /getAllPageContent/.test(read(providers))) add('ok', 'Content is rendered on the server (search engines see the edited text)');
  else add('warn', 'Content is only loaded in the browser, so search engines index the default text', 'Run  npx storio-editor init  again: it upgrades components/CmsProviders.tsx to load content on the server.');
  return checks;
}

/** Checks against the production API, as seen from the production site. */
export async function checkProductionApi(
  apiUrl: string,
  siteOrigin: string,
  fetchFn: Fetch = fetch as unknown as Fetch,
  options: { tokenAuth?: boolean } = {}
): Promise<Check[]> {
  const checks: Check[] = [];
  const add = (level: CheckLevel, title: string, fix?: string) => checks.push({ level, title, fix });
  const url = apiUrl.replace(/\/+$/, '');
  let api: URL;
  try {
    api = new URL(url);
    new URL(siteOrigin);
  } catch {
    add('fail', 'The API URL or the site origin is not a valid URL', 'Pass full URLs, for example --api-url https://api.example.com/api/cms --frontend-origin https://example.com');
    return checks;
  }

  add(api.protocol === 'https:' ? 'ok' : 'fail', api.protocol === 'https:' ? 'The API uses HTTPS' : 'The API does not use HTTPS', api.protocol === 'https:' ? undefined : 'Serve Django over HTTPS; browsers do not send secure login cookies over plain HTTP.');
  if (!siteOrigin.startsWith('https://')) add('fail', 'The site does not use HTTPS', 'Serve the site over HTTPS.');
  if (/localhost|127\.0\.0\.1/.test(url + siteOrigin)) add('warn', 'A localhost URL was given', 'Pass the real production URLs.');

  const sameSite = siteOf(url) === siteOf(siteOrigin);
  if (sameSite) add('ok', `The site and the API are on the same site (${siteOf(siteOrigin)}), so the login cookie works with the default settings`);
  else if (options.tokenAuth) add('ok', `The site (${siteOf(siteOrigin)}) and the API (${siteOf(url)}) are different sites, which is fine: editors sign in with a token, not a cookie`);
  else
    add(
      'fail',
      `The site (${siteOf(siteOrigin)}) and the API (${siteOf(url)}) are different sites`,
      'The editor login cookie becomes a third-party cookie, which Safari and other browsers block: saving fails even after logging in. Put the API on a subdomain of the site (api.example.com) or behind the same domain (example.com/api/ through a reverse proxy).'
    );

  let res: Awaited<ReturnType<Fetch>>;
  try {
    res = await fetchFn(`${url}/csrf`, { headers: { Origin: siteOrigin } });
  } catch {
    add('fail', `Cannot reach the API at ${url}`, 'Check the URL, DNS, and that Django is running.');
    return checks;
  }
  if (res.status !== 200) {
    add('fail', `${url}/csrf returned ${res.status}`, res.status === 404 ? 'Add path("api/cms/", include("storio_elements_editor.urls")) to the production urls.py.' : 'Check ALLOWED_HOSTS and the Django logs.');
    return checks;
  }
  add('ok', 'The production API is reachable');

  if (api.origin !== new URL(siteOrigin).origin) {
    const allow = res.headers.get('access-control-allow-origin');
    if (allow !== siteOrigin && allow !== '*') add('fail', `Django does not allow ${siteOrigin} (CORS)`, `Add "${siteOrigin}" to CORS_ALLOWED_ORIGINS and CSRF_TRUSTED_ORIGINS.`);
    else if (res.headers.get('access-control-allow-credentials') !== 'true') add('fail', 'CORS does not allow credentials', 'Set CORS_ALLOW_CREDENTIALS = True.');
    else add('ok', `CORS allows ${siteOrigin} with credentials`);
  }

  const cookie = (res.headers.get('set-cookie') ?? '').split(/,(?=\s*\w+=)/).find((c) => /^\s*csrftoken=/.test(c)) ?? '';
  if (cookie) {
    if (/;\s*secure/i.test(cookie)) add('ok', 'Cookies are marked Secure');
    else add('fail', 'Cookies are not marked Secure', 'Set CSRF_COOKIE_SECURE = True and SESSION_COOKIE_SECURE = True.');
    if (!sameSite && !options.tokenAuth && !/samesite=none/i.test(cookie)) add('fail', 'Cookies use SameSite=Lax across different sites', 'If you cannot share a domain: CSRF_COOKIE_SAMESITE = "None" and SESSION_COOKIE_SAMESITE = "None" (with Secure). Some browsers still block it.');
  }

  try {
    const probe = await fetchFn(`${api.origin}/storio-editor-doctor-missing-page/`);
    const body = probe.text ? await probe.text() : '';
    if (/DEBUG\s*=\s*True/.test(body)) add('fail', 'Django runs with DEBUG = True', 'Set DEBUG = False in production (it shows settings and code to anyone).');
    else add('ok', 'Django does not show debug pages');
  } catch {
    /* already reported */
  }
  return checks;
}

/** Checks against a running Django API. `fetchFn` is injectable for tests. */
export async function checkDjango(
  baseUrl: string,
  frontendOrigin: string,
  fetchFn: Fetch = fetch as unknown as Fetch,
  options: { tokenAuth?: boolean } = {}
): Promise<Check[]> {
  const checks: Check[] = [];
  const add = (level: CheckLevel, title: string, fix?: string) => checks.push({ level, title, fix });
  const url = baseUrl.replace(/\/+$/, '');

  let res;
  try {
    res = await fetchFn(`${url}/csrf`, { headers: { Origin: frontendOrigin } });
  } catch {
    add('fail', `Cannot reach Django at ${url}`, 'Start Django (python manage.py runserver) and check the baseUrl in cms.config.ts.');
    return checks;
  }
  if (res.status === 404) {
    add('fail', `${url}/csrf returned 404`, 'Django does not serve the CMS API. Add path("api/cms/", include("storio_elements_editor.urls")) to urls.py (or run init with --django-dir).');
    return checks;
  }
  if (res.status !== 200) {
    add('fail', `${url}/csrf returned ${res.status}`, 'Check the Django server log for the error.');
    return checks;
  }
  add('ok', 'Django API reachable');

  const allow = res.headers.get('access-control-allow-origin');
  if (!allow) {
    add('fail', `Django does not allow the origin ${frontendOrigin} (CORS)`, `Install django-cors-headers and set CORS_ALLOWED_ORIGINS = ["${frontendOrigin}"] and CORS_ALLOW_CREDENTIALS = True.`);
  } else if (res.headers.get('access-control-allow-credentials') !== 'true') {
    add('fail', 'CORS is on but does not allow credentials', 'Set CORS_ALLOW_CREDENTIALS = True, or editors can never log in through the CMS.');
  } else add('ok', `CORS allows ${frontendOrigin} with credentials`);

  try {
    const pre = await fetchFn(`${url}/records/home/hero`, {
      method: 'OPTIONS',
      headers: {
        Origin: frontendOrigin,
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': options.tokenAuth ? 'content-type,x-csrftoken,authorization' : 'content-type,x-csrftoken',
      },
    });
    const methods = pre.headers.get('access-control-allow-methods') ?? '';
    const headers = (pre.headers.get('access-control-allow-headers') ?? '').toLowerCase();
    if (pre.status < 300 && /PUT/i.test(methods) && headers.includes('x-csrftoken') && options.tokenAuth && !headers.includes('authorization')) {
      add('fail', 'CORS does not allow the Authorization header, so the token login cannot save', 'Add "authorization" to CORS_ALLOW_HEADERS (django-cors-headers allows it by default: remove any custom CORS_ALLOW_HEADERS that leaves it out).');
    } else if (pre.status < 300 && /PUT/i.test(methods) && headers.includes('x-csrftoken')) add('ok', options.tokenAuth ? 'Saving is allowed by CORS (PUT + X-CSRFToken + Authorization)' : 'Saving is allowed by CORS (PUT + X-CSRFToken)');
    else if (allow) add('warn', 'CORS preflight for saving was not approved', 'Make sure corsheaders is the first MIDDLEWARE entry and CORS_ALLOW_HEADERS includes "x-csrftoken" (the default does).');
  } catch {
    /* already reported unreachable above */
  }

  if (options.tokenAuth) {
    try {
      const me = await fetchFn(`${url}/auth/me`, { headers: { Origin: frontendOrigin } });
      if (me.status === 401) add('ok', 'Token login is available on the server');
      else if (me.status === 404) add('fail', 'The server has no token login (django-storio-elements-editor is too old, or TOKEN_LOGIN is False)', 'Upgrade the package: pip install -U "git+https://github.com/MostofaSeum/storio-elements-editor.git#subdirectory=django-storio-elements-editor" (or run init with --django-dir), and make sure STORIO_EDITOR["TOKEN_LOGIN"] is not False.');
      else add('warn', `${url}/auth/me returned ${me.status}`, 'Expected 401 for a visitor who is not signed in.');
    } catch {
      /* already reported unreachable above */
    }
  }

  return checks;
}

export function summarize(checks: Check[]): { ok: number; warn: number; fail: number } {
  return {
    ok: checks.filter((c) => c.level === 'ok').length,
    warn: checks.filter((c) => c.level === 'warn').length,
    fail: checks.filter((c) => c.level === 'fail').length,
  };
}
