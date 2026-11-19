import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addPageEntry, runAddPage } from '../src/cli/addPage';
import { checkDjango, checkProject, summarize } from '../src/cli/doctor';
import { runInit, type InitOptions } from '../src/cli/init';

const LAYOUT = `import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
`;

function makeProject(dir: string, tailwind = '^4') {
  const appDir = path.join(dir, 'app');
  fs.mkdirSync(appDir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 't', dependencies: { next: '15.5.0', react: '19.0.0', tailwindcss: tailwind } }));
  fs.writeFileSync(path.join(dir, 'tsconfig.json'), '{ "compilerOptions": { "resolveJsonModule": true, "paths": { "@/*": ["./*"] } } }');
  fs.writeFileSync(path.join(appDir, 'layout.tsx'), LAYOUT);
  fs.writeFileSync(path.join(appDir, 'globals.css'), '@import "tailwindcss";\n');
  fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules\n');
}

const read = (...p: string[]) => fs.readFileSync(path.join(...p), 'utf8');

describe('add-page', () => {
  let dir: string;
  const initOptions = (over: Partial<InitOptions> = {}): InitOptions => ({
    cwd: dir,
    backend: 'files',
    apiUrl: 'http://localhost:8000/api/cms',
    adminPath: 'admin/cms',
    example: false,
    install: false,
    dryRun: false,
    force: false,
    ...over,
  });
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'storio-editor-addpage-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('creates content, view, route and registers the page in the config', () => {
    makeProject(dir);
    runInit(initOptions());
    const report = runAddPage({ cwd: dir, key: 'about', sections: ['hero', 'team'], dryRun: false });
    expect(report.route).toBe('/about');
    expect(JSON.parse(read(dir, 'content', 'about.json'))).toHaveProperty('team.title');
    const view = read(dir, 'components', 'AboutView.tsx');
    expect(view).toContain('<CmsSection sectionKey="team" title="Team">');
    expect(view).toContain("usePageContent<Content>('about');");
    expect(read(dir, 'app', 'about', 'page.tsx')).toContain('return <AboutView />;');
    expect(read(dir, 'app', 'about', 'page.tsx')).not.toContain('dynamic');
    const config = read(dir, 'cms.config.ts');
    expect(config).toContain("import aboutDefaults from '@/content/about.json';");
    expect(config).toContain("key: 'about'");
    expect(config).toContain("{ key: 'team', label: 'Team' }");
  });

  it('reads sections whose key is not a usable variable name', () => {
    makeProject(dir);
    runInit(initOptions());
    runAddPage({ cwd: dir, key: 'about', sections: ['hero', 'content', 'our-team'], dryRun: false });
    const view = read(dir, 'components', 'AboutView.tsx');
    expect(view).toContain("const { hero, 'content': contentData, 'our-team': ourTeam } = usePageContent<Content>('about');");
    expect(view).toContain('{contentData.title}');
    expect(view).toContain('{ourTeam.title}');
  });

  it('can add several pages and a nested route', () => {
    makeProject(dir);
    runInit(initOptions());
    runAddPage({ cwd: dir, key: 'about', dryRun: false });
    runAddPage({ cwd: dir, key: 'pricing-plans', route: '/company/pricing', dryRun: false });
    const config = read(dir, 'cms.config.ts');
    expect(config).toContain("route: '/company/pricing'");
    expect(config).toContain("import pricingPlansDefaults from '@/content/pricing-plans.json';");
    expect(fs.existsSync(path.join(dir, 'app', 'company', 'pricing', 'page.tsx'))).toBe(true);
    expect(read(dir, 'components', 'PricingPlansView.tsx')).toContain('PricingPlansView');
  });

  it('keeps an existing page entry valid (items are separated by a comma)', () => {
    makeProject(dir);
    runInit(initOptions({ example: true }));
    runAddPage({ cwd: dir, key: 'about', dryRun: false });
    const config = read(dir, 'cms.config.ts');
    expect(config).toContain("key: 'example'");
    expect(config).toContain("key: 'about'");
    expect(config).not.toMatch(/\}\s*\{/);
  });

  it('refuses to overwrite and validates names, before writing anything', () => {
    makeProject(dir);
    runInit(initOptions());
    runAddPage({ cwd: dir, key: 'about', dryRun: false });
    expect(() => runAddPage({ cwd: dir, key: 'about', dryRun: false })).toThrow(/already exist/);
    expect(() => runAddPage({ cwd: dir, key: 'About Us', dryRun: false })).toThrow(/Invalid page key/);
    expect(() => runAddPage({ cwd: dir, key: 'x', route: '/a b', dryRun: false })).toThrow(/Invalid route/);
    expect(() => runAddPage({ cwd: dir, key: 'x', sections: ['a', 'a'], dryRun: false })).toThrow(/unique/);
    expect(fs.existsSync(path.join(dir, 'content', 'x.json'))).toBe(false);
  });

  it('needs init first, and a dry run writes nothing', () => {
    makeProject(dir);
    expect(() => runAddPage({ cwd: dir, key: 'about', dryRun: false })).toThrow(/init/);
    runInit(initOptions());
    const before = read(dir, 'cms.config.ts');
    runAddPage({ cwd: dir, key: 'about', dryRun: true });
    expect(fs.existsSync(path.join(dir, 'content', 'about.json'))).toBe(false);
    expect(read(dir, 'cms.config.ts')).toBe(before);
  });

  it('turns a section named "content" into a safe identifier', () => {
    makeProject(dir);
    runInit(initOptions());
    runAddPage({ cwd: dir, key: 'about', dryRun: false });
    const view = read(dir, 'components', 'AboutView.tsx');
    expect(view).toContain("const { hero, 'content': contentData } = usePageContent<Content>('about');");
    expect(view).toContain('{contentData.title}');
  });
});

describe('addPageEntry', () => {
  const entry = "{\n  key: 'a',\n}";

  it('handles an empty list with comments and an existing item without a trailing comma', () => {
    expect(addPageEntry('pages: [\n    // none yet\n  ],', entry, 'a').source).toContain("    {\n      key: 'a',\n    },");
    const withItem = addPageEntry("pages: [\n    { key: 'x', sections: [{ key: 's' }] }\n  ],", entry, 'a');
    expect(withItem.source).toContain("{ key: 'x', sections: [{ key: 's' }] },");
  });

  it('reports a missing list and an already registered page', () => {
    expect(addPageEntry('const x = 1;', entry, 'a').status).toBe('manual');
    expect(addPageEntry("pages: [ { key: 'a' } ]", entry, 'a').status).toBe('already');
  });

  it('is not confused by brackets inside strings and comments', () => {
    const src = "pages: [\n    { key: 'x', title: 'A ] b' }, // ] trick\n  ],";
    const result = addPageEntry(src, "{ key: 'y' }", 'y');
    expect(result.status).toBe('changed');
    expect(result.source.indexOf("key: 'y'")).toBeGreaterThan(result.source.indexOf('// ] trick'));
  });
});

describe('doctor', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'storio-editor-doctor-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const titles = (checks: { level: string; title: string }[], level: string) => checks.filter((c) => c.level === level).map((c) => c.title);

  it('flags a project where nothing is set up yet', () => {
    makeProject(dir);
    const failures = titles(checkProject(dir).checks, 'fail').join('|');
    expect(failures).toMatch(/storio-elements-editor is missing/);
    expect(failures).toMatch(/does not scan the library/);
    expect(failures).toMatch(/cms.config.ts not found/);
  });

  it('passes the project checks after init and finds the Django URL', () => {
    makeProject(dir);
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ dependencies: { next: '15.5.0', tailwindcss: '^4', '@brainicon/storio-elements-editor': '0.1.0', 'react-hot-toast': '2', 'lucide-react': '1' } })
    );
    runInit({ cwd: dir, backend: 'django', apiUrl: 'http://localhost:8000/api/cms', adminPath: 'admin/cms', example: true, install: false, dryRun: false, force: false });
    const { checks, djangoBaseUrl } = checkProject(dir);
    expect(titles(checks, 'fail')).toEqual([]);
    expect(djangoBaseUrl).toBe('http://localhost:8000/api/cms');
  });

  it('detects Tailwind v3', () => {
    makeProject(dir, '^3.4.0');
    expect(titles(checkProject(dir).checks, 'fail').join('|')).toMatch(/Tailwind CSS v3/);
  });

  const reply = (status: number, headers: Record<string, string> = {}) => ({ status, headers: { get: (n: string) => headers[n.toLowerCase()] ?? null } });
  const origin = 'http://localhost:3000';

  it('explains an unreachable server, a missing route and missing CORS', async () => {
    const down = await checkDjango('http://x/api/cms', origin, async () => {
      throw new Error('ECONNREFUSED');
    });
    expect(down[0].title).toMatch(/Cannot reach Django/);
    const missing = await checkDjango('http://x/api/cms', origin, async () => reply(404));
    expect(missing[0].fix).toMatch(/storio_elements_editor\.urls/);
    const noCors = await checkDjango('http://x/api/cms', origin, async () => reply(200));
    expect(titles(noCors, 'fail').join('|')).toMatch(/CORS/);
  });

  it('requires credentials and an approved preflight for saving', async () => {
    const noCreds = await checkDjango('http://x/api/cms', origin, async () => reply(200, { 'access-control-allow-origin': origin }));
    expect(titles(noCreds, 'fail').join('|')).toMatch(/credentials/);

    const good = await checkDjango('http://x/api/cms', origin, async (_url, init) =>
      init?.method === 'OPTIONS'
        ? reply(200, { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET, PUT, DELETE', 'access-control-allow-headers': 'content-type, x-csrftoken' })
        : reply(200, { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' })
    );
    expect(summarize(good)).toEqual({ ok: 3, warn: 0, fail: 0 });
  });
});
