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
const LIB = '@brainicon/visual-cms';

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
  const withSource = css.find((f) => /@source[^;\n]*visual-cms/.test(read(f)));
  add(
    withSource ? 'ok' : 'fail',
    withSource ? 'Tailwind scans the library (@source line)' : 'Tailwind does not scan the library',
    withSource ? undefined : 'Add to your global CSS, below @import "tailwindcss":   @source "../node_modules/@brainicon/visual-cms/dist";   (the path is relative to that CSS file)'
  );

  const config = [path.join(base, 'cms.config.ts'), path.join(root, 'cms.config.ts')].find(exists);
  let djangoBaseUrl: string | null = null;
  if (!config) add('fail', 'cms.config.ts not found', 'Run:  npx visual-cms init');
  else {
    add('ok', `Config found (${path.relative(root, config).split(path.sep).join('/')})`);
    const text = read(config);
    djangoBaseUrl = text.match(/djangoAdapter\(\s*\{\s*baseUrl:\s*['"`]([^'"`]+)['"`]/)?.[1] ?? null;
    if (!/\bkey:\s*['"]/.test(text)) add('warn', 'No pages are listed in cms.config.ts yet', 'Add one with:  npx visual-cms add-page <name>');
  }

  const sources = walk(appDir, (f) => /\.(tsx|jsx|ts|js)$/.test(f)).concat(walk(path.join(base, 'components'), (f) => /\.(tsx|jsx)$/.test(f)));
  const has = (re: RegExp) => sources.find((f) => re.test(read(f)));
  add(has(/<CmsProvider\b/) ? 'ok' : 'fail', has(/<CmsProvider\b/) ? 'CmsProvider wraps the app' : 'CmsProvider is not used', has(/<CmsProvider\b/) ? undefined : 'Wrap {children} in your root layout with <CmsProviders> (init creates components/CmsProviders.tsx).');
  const studio = has(/<CmsStudio\b/);
  add(studio ? 'ok' : 'fail', studio ? `CMS screen found (${path.relative(root, studio).split(path.sep).join('/')})` : 'No CMS screen found', studio ? undefined : 'Create a page that renders <CmsStudio config={cms} /> (init creates app/admin/cms/page.tsx).');
  if (!has(/<CmsSection\b/)) add('warn', 'No page uses <CmsSection> yet, so nothing shows a pencil button', 'Wrap an editable block:  <CmsSection sectionKey="hero" title="Hero">…</CmsSection>');

  return { checks, djangoBaseUrl };
}

type Fetch = (url: string, init?: { method?: string; headers?: Record<string, string> }) => Promise<{ status: number; headers: { get(name: string): string | null } }>;

/** Checks against a running Django API. `fetchFn` is injectable for tests. */
export async function checkDjango(baseUrl: string, frontendOrigin: string, fetchFn: Fetch = fetch as unknown as Fetch): Promise<Check[]> {
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
    add('fail', `${url}/csrf returned 404`, 'Django does not serve the CMS API. Add path("api/cms/", include("visual_cms.urls")) to urls.py (or run init with --django-dir).');
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
      headers: { Origin: frontendOrigin, 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'content-type,x-csrftoken' },
    });
    const methods = pre.headers.get('access-control-allow-methods') ?? '';
    const headers = (pre.headers.get('access-control-allow-headers') ?? '').toLowerCase();
    if (pre.status < 300 && /PUT/i.test(methods) && headers.includes('x-csrftoken')) add('ok', 'Saving is allowed by CORS (PUT + X-CSRFToken)');
    else if (allow) add('warn', 'CORS preflight for saving was not approved', 'Make sure corsheaders is the first MIDDLEWARE entry and CORS_ALLOW_HEADERS includes "x-csrftoken" (the default does).');
  } catch {
    /* already reported unreachable above */
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
