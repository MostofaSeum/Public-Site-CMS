import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addGitignoreEntries,
  addImportLine,
  addTailwindSource,
  detectAlias,
  importSpecifier,
  wrapLayoutWithProviders,
} from '../src/cli/edit';
import { findDjangoProject, findPython } from '../src/cli/django';
import { CliError, runInit, type InitOptions } from '../src/cli/init';
import { askMissingOptions } from '../src/cli/prompts';

const LAYOUT = `import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={geist.className}>
        {children}
      </body>
    </html>
  );
}
`;

describe('wrapLayoutWithProviders', () => {
  it('wraps {children} inside <body> and adds the import after the last import', () => {
    const result = wrapLayoutWithProviders(LAYOUT, '@/components/CmsProviders');
    expect(result.status).toBe('changed');
    expect(result.source).toContain('<CmsProviders>{children}</CmsProviders>');
    expect(result.source).toContain(`import "./globals.css";\nimport { CmsProviders } from '@/components/CmsProviders';`);
    // Nothing else changed.
    expect(result.source.replace("import { CmsProviders } from '@/components/CmsProviders';\n", '').replace('<CmsProviders>{children}</CmsProviders>', '{children}')).toBe(LAYOUT);
  });

  it('is idempotent', () => {
    const once = wrapLayoutWithProviders(LAYOUT, '@/c').source;
    const twice = wrapLayoutWithProviders(once, '@/c');
    expect(twice.status).toBe('already');
    expect(twice.source).toBe(once);
  });

  it('handles multi-line imports, CRLF files and "{ children }" spacing', () => {
    const source = `import {\r\n  Foo,\r\n  Bar,\r\n} from 'x';\r\nexport default function L({ children }) {\r\n  return <html><body>{ children }</body></html>;\r\n}\r\n`;
    const result = wrapLayoutWithProviders(source, './p');
    expect(result.status).toBe('changed');
    expect(result.source).toContain("} from 'x';\r\nimport { CmsProviders } from './p';\r\n");
    expect(result.source).toContain('<CmsProviders>{children}</CmsProviders>');
  });

  it('asks for a manual edit when there is no <body> or no {children}', () => {
    expect(wrapLayoutWithProviders('export default () => null;', './p').status).toBe('manual');
    expect(wrapLayoutWithProviders('export default () => <html><body><Page /></body></html>;', './p').status).toBe('manual');
  });
});

describe('addImportLine', () => {
  it('puts the import after "use client" when the file has no imports', () => {
    expect(addImportLine("'use client';\n\nexport const a = 1;\n", "import x from 'x';")).toBe(
      "'use client';\nimport x from 'x';\n\n\nexport const a = 1;\n".replace("'use client';\nimport", "'use client';\nimport")
    );
  });
});

describe('addTailwindSource', () => {
  it('adds @source under the tailwind import and is idempotent', () => {
    const css = '@import "tailwindcss";\n\n:root { --a: 1; }\n';
    const once = addTailwindSource(css, '../node_modules/@brainicon/visual-cms/dist');
    expect(once.status).toBe('changed');
    expect(once.source).toBe('@import "tailwindcss";\n@source "../node_modules/@brainicon/visual-cms/dist";\n\n:root { --a: 1; }\n');
    expect(addTailwindSource(once.source, 'x').status).toBe('already');
  });

  it('keeps import options and reports Tailwind v3 / missing imports as manual', () => {
    expect(addTailwindSource("@import 'tailwindcss' prefix(tw);\n", './d').source).toContain("@import 'tailwindcss' prefix(tw);\n@source");
    expect(addTailwindSource('@tailwind base;\n', './d')).toMatchObject({ status: 'manual', reason: expect.stringContaining('v3') });
    expect(addTailwindSource('body {}', './d').status).toBe('manual');
  });
});

describe('addGitignoreEntries', () => {
  it('appends only missing entries', () => {
    const result = addGitignoreEntries('node_modules\n/.cms\n', ['.cms', 'public/cms-uploads']);
    expect(result.added).toEqual(['public/cms-uploads']);
    expect(result.source).toContain('public/cms-uploads');
    expect(result.source.match(/\.cms/g)).toHaveLength(1);
    expect(addGitignoreEntries(result.source, ['.cms', 'public/cms-uploads']).added).toEqual([]);
  });

  it('handles a file without a trailing newline', () => {
    expect(addGitignoreEntries('node_modules', ['.cms']).source).toBe('node_modules\n\n# visual-cms content and uploads\n.cms\n');
  });
});

describe('alias and import specifiers', () => {
  const root = path.resolve('/proj');
  it('reads the @/* alias from a tsconfig with comments', () => {
    const tsconfig = `{ // comment\n "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }`;
    expect(detectAlias(tsconfig, root)?.root).toBe(path.resolve('/proj/src'));
    expect(detectAlias('{ "compilerOptions": {} }', root)).toBeNull();
  });

  it('uses the alias when possible and relative paths otherwise', () => {
    const alias = { root: path.resolve('/proj/src') };
    const from = path.resolve('/proj/src/app/api/cms/route.ts');
    expect(importSpecifier(from, path.resolve('/proj/src/lib/cms-storage.ts'), alias)).toBe('@/lib/cms-storage');
    expect(importSpecifier(from, path.resolve('/proj/src/content/x.json'), alias)).toBe('@/content/x.json');
    expect(importSpecifier(from, path.resolve('/proj/lib/outside.ts'), alias)).toBe('../../../../lib/outside');
    expect(importSpecifier(path.resolve('/proj/a/b.ts'), path.resolve('/proj/a/c.ts'), null)).toBe('./c');
  });
});

// ----------------------------------------------------------------------------- init

function makeProject(dir: string, opts: { src?: boolean; alias?: boolean; layout?: string; tailwind?: string } = {}) {
  const appDir = opts.src ? path.join(dir, 'src', 'app') : path.join(dir, 'app');
  fs.mkdirSync(appDir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 't', dependencies: { next: '15.5.0', react: '19.0.0', tailwindcss: opts.tailwind ?? '^4' } })
  );
  const paths = opts.alias === false ? '' : `, "paths": { "@/*": ["${opts.src ? './src/*' : './*'}"] }`;
  fs.writeFileSync(path.join(dir, 'tsconfig.json'), `{ "compilerOptions": { "resolveJsonModule": true${paths} } }`);
  fs.writeFileSync(path.join(appDir, 'layout.tsx'), opts.layout ?? LAYOUT);
  fs.writeFileSync(path.join(appDir, 'globals.css'), '@import "tailwindcss";\n');
  fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules\n.next\n');
  return appDir;
}

describe('runInit', () => {
  let dir: string;
  const options = (over: Partial<InitOptions> = {}): InitOptions => ({
    cwd: dir,
    backend: 'files',
    apiUrl: 'http://localhost:8000/api/cms',
    adminPath: 'admin/cms',
    example: true,
    install: false,
    dryRun: false,
    force: false,
    ...over,
  });
  const snapshot = () => {
    const out: Record<string, string> = {};
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.name === 'node_modules') continue;
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else out[path.relative(dir, p).split(path.sep).join('/')] = fs.readFileSync(p, 'utf8');
      }
    };
    walk(dir);
    return out;
  };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-cms-init-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('sets up a project with the file backend', () => {
    makeProject(dir);
    const report = runInit(options());
    const files = snapshot();

    for (const f of [
      'cms.config.ts',
      'lib/cms-storage.ts',
      'components/CmsProviders.tsx',
      'components/CmsExampleView.tsx',
      'content/cms-example.json',
      'app/api/cms/[...path]/route.ts',
      'app/admin/cms/page.tsx',
      'app/admin/layout.tsx',
      'app/cms-example/page.tsx',
    ]) {
      expect(files, f).toHaveProperty([f]);
    }
    expect(files['app/layout.tsx']).toContain('<CmsProviders>{children}</CmsProviders>');
    expect(files['app/layout.tsx']).toContain("from '@/components/CmsProviders'");
    expect(files['app/globals.css']).toContain('@source "../node_modules/@brainicon/visual-cms/dist";');
    expect(files['.gitignore']).toContain('.cms');
    expect(files['cms.config.ts']).toContain("restAdapter({ baseUrl: '/api/cms' })");
    expect(files['cms.config.ts']).toContain("from '@/content/cms-example.json'");
    expect(files['app/api/cms/[...path]/route.ts']).toContain("process.env.NODE_ENV === 'development'");

    expect(report.adminUrl).toBe('/admin/cms');
    expect(report.exampleUrl).toBe('/cms-example');
    // Missing library + peers are reported, and the dev is told about authorize().
    expect(report.installCommand).toBe('npm install @brainicon/visual-cms lucide-react react-hot-toast');
    expect(report.warnings.join(' ')).toContain('authorize()');
  });

  it('is idempotent: a second run changes nothing', () => {
    makeProject(dir);
    runInit(options());
    const first = snapshot();
    const second = runInit(options());
    expect(snapshot()).toEqual(first);
    expect(second.actions.every((a) => a.kind === 'unchanged')).toBe(true);
    // The admin layout this tool made is recognised, not mistaken for the developer's own panel.
    expect(second.actions.map((a) => a.file)).toContain('app/admin/layout.tsx');
    expect(second.manual.join(' ')).not.toContain('CmsNavButton');
  });

  it('never overwrites existing files unless --force', () => {
    makeProject(dir);
    fs.writeFileSync(path.join(dir, 'cms.config.ts'), '// mine\n');
    const report = runInit(options());
    expect(fs.readFileSync(path.join(dir, 'cms.config.ts'), 'utf8')).toBe('// mine\n');
    expect(report.actions.find((a) => a.file === 'cms.config.ts')?.kind).toBe('skipped');

    runInit(options({ force: true }));
    expect(fs.readFileSync(path.join(dir, 'cms.config.ts'), 'utf8')).toContain('defineCms');
  });

  it('writes nothing in dry-run mode', () => {
    makeProject(dir);
    const before = snapshot();
    const report = runInit(options({ dryRun: true }));
    expect(snapshot()).toEqual(before);
    expect(report.actions.some((a) => a.kind === 'created')).toBe(true);
  });

  it('supports the src/ layout and projects without an @/ alias', () => {
    makeProject(dir, { src: true });
    runInit(options());
    expect(fs.existsSync(path.join(dir, 'src/cms.config.ts'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'src/app/admin/cms/page.tsx'))).toBe(true);
    expect(fs.readFileSync(path.join(dir, 'src/app/layout.tsx'), 'utf8')).toContain("from '@/components/CmsProviders'");
    expect(fs.readFileSync(path.join(dir, 'src/app/globals.css'), 'utf8')).toContain('@source "../../node_modules/@brainicon/visual-cms/dist";');

    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-cms-init-'));
    try {
      makeProject(other, { alias: false });
      runInit({ ...options(), cwd: other });
      expect(fs.readFileSync(path.join(other, 'app/layout.tsx'), 'utf8')).toContain("from '../components/CmsProviders'");
      expect(fs.readFileSync(path.join(other, 'app/admin/cms/page.tsx'), 'utf8')).toContain("from '../../../cms.config'");
      expect(fs.readFileSync(path.join(other, 'cms.config.ts'), 'utf8')).toContain("from './content/cms-example.json'");
    } finally {
      fs.rmSync(other, { recursive: true, force: true });
    }
  });

  it('generates the Django variant', () => {
    makeProject(dir);
    const report = runInit(options({ backend: 'django', apiUrl: 'https://api.example.com/api/cms', example: false }));
    const files = snapshot();
    expect(files['cms.config.ts']).toContain("const API_URL = process.env.NEXT_PUBLIC_CMS_API_URL ?? 'https://api.example.com/api/cms';");
    expect(files['cms.config.ts']).toContain('djangoAdapter({ baseUrl: API_URL, headers: cmsLogin.headers })');
    expect(files['cms.config.ts']).not.toContain('cms-example');
    expect(files['lib/cms-storage.ts']).toContain('cms.adapter');
    expect(files).not.toHaveProperty(['app/api/cms/[...path]/route.ts']);
    expect(files).not.toHaveProperty(['app/cms-example/page.tsx']);
    expect(report.manual.join('\n')).toContain('django-visual-cms');
    expect(report.exampleUrl).toBeNull();
  });

  it('rejects --django-dir without the Django backend or without a manage.py, before writing anything', () => {
    makeProject(dir);
    const before = snapshot();
    expect(() => runInit(options({ backend: 'files', djangoDir: dir }))).toThrow(/--backend django/);
    expect(() => runInit(options({ backend: 'django', djangoDir: path.join(dir, 'nope') }))).toThrow(/No Django project found/);
    expect(snapshot()).toEqual(before);
  });

  it('keeps an existing admin area and tells the developer to add the button', () => {
    const appDir = makeProject(dir);
    fs.mkdirSync(path.join(appDir, 'admin'));
    fs.writeFileSync(path.join(appDir, 'admin', 'layout.tsx'), '// existing admin layout\n');
    const report = runInit(options());
    expect(fs.readFileSync(path.join(appDir, 'admin', 'layout.tsx'), 'utf8')).toBe('// existing admin layout\n');
    expect(fs.existsSync(path.join(appDir, 'admin', 'cms', 'page.tsx'))).toBe(true);
    expect(report.manual.join('\n')).toContain('<CmsNavButton href="/admin/cms"');
  });

  it('supports route groups in the admin path (the group is a folder, not part of the URL)', () => {
    const appDir = makeProject(dir);
    fs.mkdirSync(path.join(appDir, '(dashboard)', 'dashboard'), { recursive: true });
    fs.writeFileSync(path.join(appDir, '(dashboard)', 'layout.tsx'), '// guard\n');
    const report = runInit(options({ adminPath: '(dashboard)/dashboard/cms' }));

    expect(fs.existsSync(path.join(appDir, '(dashboard)', 'dashboard', 'cms', 'page.tsx'))).toBe(true);
    // The existing layout in the group is untouched and no stray layout is created.
    expect(fs.readFileSync(path.join(appDir, '(dashboard)', 'layout.tsx'), 'utf8')).toBe('// guard\n');
    expect(fs.existsSync(path.join(appDir, '(dashboard)', 'dashboard', 'layout.tsx'))).toBe(false);
    expect(report.adminUrl).toBe('/dashboard/cms');
    expect(report.manual.join(' ')).toContain('href="/dashboard/cms"');
    expect(report.manual.join(' ')).not.toContain('(dashboard)/dashboard/cms"');
  });

  it('rejects an admin path that has no URL part', () => {
    makeProject(dir);
    expect(() => runInit(options({ adminPath: '(dashboard)' }))).toThrow(/no URL part/);
  });

  it('supports a custom admin path', () => {
    makeProject(dir);
    const report = runInit(options({ adminPath: 'dashboard/site' }));
    expect(fs.existsSync(path.join(dir, 'app/dashboard/site/page.tsx'))).toBe(true);
    expect(fs.readFileSync(path.join(dir, 'app/dashboard/layout.tsx'), 'utf8')).toContain('href="/dashboard/site"');
    expect(report.adminUrl).toBe('/dashboard/site');
  });

  it('leaves manual instructions when it cannot edit a file', () => {
    makeProject(dir, { layout: 'export default function L() { return null; }\n' });
    fs.writeFileSync(path.join(dir, 'app/globals.css'), '@tailwind base;\n');
    const report = runInit(options());
    const manual = report.manual.join('\n');
    expect(manual).toContain('CmsProviders');
    expect(manual).toContain('@source');
    expect(fs.readFileSync(path.join(dir, 'app/globals.css'), 'utf8')).toBe('@tailwind base;\n');
  });

  it('warns about Tailwind v3 and a middleware file, and skips installs when deps exist', () => {
    makeProject(dir, { tailwind: '^3.4.0' });
    fs.writeFileSync(path.join(dir, 'middleware.ts'), 'export {};\n');
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    pkg.dependencies = { ...pkg.dependencies, '@brainicon/visual-cms': '0.1.0', 'lucide-react': '1', 'react-hot-toast': '2' };
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg));
    const report = runInit(options());
    expect(report.warnings.join(' ')).toContain('Tailwind CSS v3');
    expect(report.manual.join('\n')).toContain('isCmsPreviewRequest');
    expect(report.installCommand).toBeNull();
  });

  it('explains unsupported projects clearly', () => {
    expect(() => runInit(options())).toThrow(/No package.json/);

    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ dependencies: { react: '19' } }));
    expect(() => runInit(options())).toThrow(/not look like a Next\.js project/);

    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ dependencies: { next: '15' } }));
    fs.mkdirSync(path.join(dir, 'pages'));
    expect(() => runInit(options())).toThrow(/Pages Router/);

    fs.mkdirSync(path.join(dir, 'app'));
    expect(() => runInit(options())).toThrow(/TypeScript/);
    expect(() => runInit(options())).toThrow(CliError);
  });

  it('picks the package manager from the lockfile', () => {
    makeProject(dir);
    fs.writeFileSync(path.join(dir, 'pnpm-lock.yaml'), '');
    expect(runInit(options()).installCommand).toBe('pnpm add @brainicon/visual-cms lucide-react react-hot-toast');
  });
});

describe('findDjangoProject / findPython', () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-cms-dj-'));
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('finds manage.py in the folder itself or one folder down, ignoring venv and node_modules', () => {
    fs.mkdirSync(path.join(root, 'backend'));
    fs.writeFileSync(path.join(root, 'backend', 'manage.py'), '');
    fs.mkdirSync(path.join(root, 'venv', 'Lib', 'site-packages', 'x'), { recursive: true });
    fs.writeFileSync(path.join(root, 'venv', 'Lib', 'site-packages', 'x', 'manage.py'), '');
    expect(findDjangoProject(root)?.dir).toBe(path.join(root, 'backend'));
    expect(findDjangoProject(path.join(root, 'backend'))?.dir).toBe(path.join(root, 'backend'));
  });

  it('refuses to guess when several projects or none are found', () => {
    expect(findDjangoProject(root)).toBeNull();
    for (const name of ['a', 'b']) {
      fs.mkdirSync(path.join(root, name));
      fs.writeFileSync(path.join(root, name, 'manage.py'), '');
    }
    expect(findDjangoProject(root)).toBeNull();
  });

  it('prefers the virtual environment next to the project', () => {
    fs.mkdirSync(path.join(root, 'backend'));
    const bin = process.platform === 'win32' ? path.join('Scripts', 'python.exe') : path.join('bin', 'python');
    fs.mkdirSync(path.join(root, 'venv', path.dirname(bin)), { recursive: true });
    fs.writeFileSync(path.join(root, 'venv', bin), '');
    const found = findPython(path.join(root, 'backend'));
    expect(found.venv).toBe(true);
    expect(found.command).toBe(path.join(root, 'venv', bin));
    expect(findPython(fs.mkdtempSync(path.join(os.tmpdir(), 'visual-cms-none-'))).venv).toBe(false);
  });
});

describe('askMissingOptions', () => {
  const base: InitOptions = {
    cwd: '.',
    backend: 'files',
    apiUrl: 'http://localhost:8000/api/cms',
    adminPath: 'admin/cms',
    example: true,
    install: true,
    dryRun: false,
    force: false,
  };
  const scripted = (answers: string[]) => {
    const asked: string[] = [];
    const ask = async (q: string) => {
      asked.push(q);
      return answers.shift() ?? '';
    };
    return { ask, asked };
  };

  it('keeps the defaults when the user just presses Enter', async () => {
    const { ask, asked } = scripted(['', '', '']);
    expect(await askMissingOptions(base, new Set(), ask)).toEqual(base);
    expect(asked).toHaveLength(3); // backend, admin path, example (no Django URL question for files)
  });

  it('asks for the Django URL only after choosing Django, and applies every answer', async () => {
    const { ask, asked } = scripted(['2', 'https://api.example.com/api/cms', 'skip', 'dashboard/site', 'n']);
    const result = await askMissingOptions(base, new Set(), ask);
    expect(result).toMatchObject({
      backend: 'django',
      apiUrl: 'https://api.example.com/api/cms',
      adminPath: 'dashboard/site',
      example: false,
    });
    expect(result.djangoDir).toBeUndefined();
    expect(asked).toHaveLength(5);
  });

  it('takes the Django folder the user types', async () => {
    const { ask } = scripted(['2', '', '../backend', '', '']);
    const result = await askMissingOptions(base, new Set(), ask);
    expect(result.djangoDir).toBe('../backend');
  });

  it('never asks about options that were passed as flags', async () => {
    const { ask, asked } = scripted([]);
    const given = new Set(['backend', 'api-url', 'django-dir', 'admin-path', 'no-example']);
    const flagged = { ...base, backend: 'django' as const, example: false };
    expect(await askMissingOptions(flagged, given, ask)).toEqual(flagged);
    expect(asked).toEqual([]);
  });
});
