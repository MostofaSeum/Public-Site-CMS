import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  addGitignoreEntries,
  addTailwindSource,
  detectAlias,
  importSpecifier,
  wrapLayoutWithProviders,
  type AliasInfo,
} from './edit';
import { findDjangoProject, runDjangoSetup } from './django';
import * as t from './templates';
import type { Backend } from './templates';

export interface InitOptions {
  cwd: string;
  backend: Backend;
  /** Base URL of the Django API (django backend only). */
  apiUrl: string;
  /** Route of the CMS screen, e.g. "admin/cms". */
  adminPath: string;
  /** Create an example page at /cms-example. */
  example: boolean;
  /** Install missing dependencies with the project's package manager. */
  install: boolean;
  /** Report what would happen without writing anything. */
  dryRun: boolean;
  /** Overwrite existing files that differ. */
  force: boolean;
  /** Django project folder (the one with manage.py). When set, the Django side is set up too. */
  djangoDir?: string | null;
  /** Origin the Next.js site runs on, allowed by Django (default http://localhost:3000). */
  frontendOrigin?: string;
}

export type ActionKind = 'created' | 'modified' | 'overwritten' | 'unchanged' | 'skipped';

export interface Action {
  kind: ActionKind;
  file: string;
  note?: string;
}

export interface InitReport {
  actions: Action[];
  warnings: string[];
  /** Things the developer still has to do by hand. */
  manual: string[];
  installed: string[];
  installCommand: string | null;
  adminUrl: string;
  exampleUrl: string | null;
  packageManager: PackageManager;
  backend: Backend;
}

export class CliError extends Error {}

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

const LIB = '@brainicon/visual-cms';
const PEERS = ['lucide-react', 'react-hot-toast'];

const exists = (p: string) => fs.existsSync(p);
const read = (p: string) => fs.readFileSync(p, 'utf8');

function firstExisting(base: string, names: string[]): string | null {
  for (const name of names) {
    const candidate = path.join(base, name);
    if (exists(candidate)) return candidate;
  }
  return null;
}

export function detectPackageManager(root: string): PackageManager {
  if (exists(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (exists(path.join(root, 'yarn.lock'))) return 'yarn';
  if (exists(path.join(root, 'bun.lockb')) || exists(path.join(root, 'bun.lock'))) return 'bun';
  if (exists(path.join(root, 'package-lock.json'))) return 'npm';
  const agent = process.env.npm_config_user_agent ?? '';
  if (agent.startsWith('pnpm')) return 'pnpm';
  if (agent.startsWith('yarn')) return 'yarn';
  if (agent.startsWith('bun')) return 'bun';
  return 'npm';
}

function installArgs(pm: PackageManager, packages: string[]): string[] {
  return pm === 'npm' ? ['install', ...packages] : ['add', ...packages];
}

/** Folder of the installed library, searching upwards (works with hoisted/monorepo installs). */
function findLibraryDir(root: string): string | null {
  let dir = root;
  for (;;) {
    const candidate = path.join(dir, 'node_modules', '@brainicon', 'visual-cms');
    if (exists(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function runInit(options: InitOptions): InitReport {
  const root = path.resolve(options.cwd);
  const actions: Action[] = [];
  const warnings: string[] = [];
  const manual: string[] = [];
  const rel = (p: string) => path.relative(root, p).split(path.sep).join('/');

  // ------------------------------------------------------------------ detect project
  const pkgPath = path.join(root, 'package.json');
  if (!exists(pkgPath)) {
    throw new CliError(`No package.json in ${root}. Run this command from the root of your Next.js project.`);
  }
  const pkg = JSON.parse(read(pkgPath)) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const deps = { ...pkg.devDependencies, ...pkg.dependencies };
  if (!deps.next) {
    throw new CliError('This does not look like a Next.js project (no "next" in package.json).');
  }

  const srcApp = path.join(root, 'src', 'app');
  const plainApp = path.join(root, 'app');
  const appDir = exists(srcApp) ? srcApp : exists(plainApp) ? plainApp : null;
  if (!appDir) {
    throw new CliError(
      exists(path.join(root, 'pages')) || exists(path.join(root, 'src', 'pages'))
        ? 'Found the Pages Router only. The init command needs the App Router (an app/ folder).'
        : 'Could not find an app/ or src/app/ folder. The init command needs the Next.js App Router.'
    );
  }
  const base = appDir === srcApp ? path.join(root, 'src') : root;

  const tsconfigPath = path.join(root, 'tsconfig.json');
  if (!exists(tsconfigPath)) {
    throw new CliError('No tsconfig.json found. The init command generates TypeScript files, so it needs a TypeScript project.');
  }
  const tsconfigText = read(tsconfigPath);
  const alias: AliasInfo | null = detectAlias(tsconfigText, root);
  if (!/"resolveJsonModule"\s*:\s*true/.test(tsconfigText)) {
    warnings.push('tsconfig.json does not enable "resolveJsonModule"; importing content/*.json may fail to type-check.');
  }

  const twVersion = deps.tailwindcss?.match(/\d+/)?.[0];
  if (!twVersion) warnings.push('Tailwind CSS is not installed. The CMS screens are styled with Tailwind v4.');
  else if (Number(twVersion) < 4) warnings.push(`Tailwind CSS v${twVersion} found. The CMS screens need Tailwind v4.`);

  // Validate the Django folder before anything is written.
  let djangoDir: string | null = null;
  if (options.djangoDir) {
    if (options.backend !== 'django') throw new CliError('--django-dir only makes sense with --backend django.');
    const project = findDjangoProject(path.resolve(root, options.djangoDir));
    if (!project) {
      throw new CliError(
        `No Django project found at "${options.djangoDir}". Point --django-dir at the folder that contains manage.py (or the folder above it).`
      );
    }
    djangoDir = project.dir;
  }

  const nextMajor = Number(deps.next.match(/\d+/)?.[0] ?? 0);
  if (nextMajor && nextMajor < 14) warnings.push(`Next.js ${deps.next} found. The library supports Next.js 14 and newer.`);

  // Folder segments of the CMS screen. Route groups, like "(dashboard)", are folders but not part of the URL.
  const adminSegments = options.adminPath.split('/').filter(Boolean);
  const adminUrlSegments = adminSegments.filter((segment) => !/^\(.+\)$/.test(segment));
  if (adminUrlSegments.length === 0) {
    throw new CliError(`The admin path "${options.adminPath}" has no URL part. Add a normal folder, for example "${options.adminPath}/cms".`);
  }
  const adminUrl = `/${adminUrlSegments.join('/')}`;
  const adminRoot = path.join(appDir, adminSegments[0]);
  const adminRootExisted = exists(adminRoot);

  // ------------------------------------------------------------------ file paths
  const files = {
    config: path.join(base, 'cms.config.ts'),
    storage: path.join(base, 'lib', 'cms-storage.ts'),
    providers: path.join(base, 'components', 'CmsProviders.tsx'),
    clientProviders: path.join(base, 'components', 'CmsClientProviders.tsx'),
    exampleJson: path.join(base, 'content', 'cms-example.json'),
    exampleView: path.join(base, 'components', 'CmsExampleView.tsx'),
    apiRoute: path.join(appDir, 'api', 'cms', '[...path]', 'route.ts'),
    adminPage: path.join(appDir, ...adminSegments, 'page.tsx'),
    adminLayout: path.join(adminRoot, 'layout.tsx'),
    examplePage: path.join(appDir, 'cms-example', 'page.tsx'),
  };
  const imp = (from: string, target: string) => importSpecifier(from, target, alias);

  // ------------------------------------------------------------------ write helpers
  const writeNew = (file: string, content: string, note?: string) => {
    if (exists(file)) {
      if (read(file) === content) {
        actions.push({ kind: 'unchanged', file: rel(file) });
        return;
      }
      if (!options.force) {
        actions.push({ kind: 'skipped', file: rel(file), note: note ?? 'already exists (use --force to overwrite)' });
        return;
      }
      if (!options.dryRun) fs.writeFileSync(file, content);
      actions.push({ kind: 'overwritten', file: rel(file) });
      return;
    }
    if (!options.dryRun) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    }
    actions.push({ kind: 'created', file: rel(file) });
  };

  const modify = (file: string, content: string, note?: string) => {
    if (!options.dryRun) fs.writeFileSync(file, content);
    actions.push({ kind: 'modified', file: rel(file), note });
  };

  // ------------------------------------------------------------------ generate files
  // importSpecifier only strips .ts/.tsx, so the .json extension stays in the specifier.
  const jsonSpec = (from: string) => imp(from, files.exampleJson);

  writeNew(
    files.config,
    t.cmsConfig({
      backend: options.backend,
      apiUrl: options.apiUrl,
      example: options.example,
      exampleJsonImport: jsonSpec(files.config),
    }),
    'already exists. Make sure it lists your pages and uses the adapter you want.'
  );

  if (options.backend === 'files') {
    writeNew(files.storage, t.filesStorage());
    writeNew(files.apiRoute, t.apiRoute({ storageImport: imp(files.apiRoute, files.storage), configImport: imp(files.apiRoute, files.config) }));
  } else {
    writeNew(files.storage, t.djangoStorage(imp(files.storage, files.config)));
  }

  // How the server loads content: Next 16 cacheComponents forbids per-request reads outside
  // <Suspense>, so it gets a short cache; otherwise content is read on every request.
  const nextConfigFile = firstExisting(root, ['next.config.ts', 'next.config.mjs', 'next.config.js', 'next.config.cjs']);
  const cacheComponents = nextConfigFile ? /cacheComponents\s*:\s*true/.test(read(nextConfigFile)) : false;
  const renderMode: t.RenderMode = cacheComponents ? 'cache' : nextMajor >= 15 || !nextMajor ? 'connection' : 'nostore';

  writeNew(files.clientProviders, t.clientProviders(imp(files.clientProviders, files.config)));
  const providersSource = t.providers({
    configImport: imp(files.providers, files.config),
    storageImport: imp(files.providers, files.storage),
    clientImport: imp(files.providers, files.clientProviders),
    mode: renderMode,
  });
  // A provider generated by an older version is replaced automatically (it has no edits of yours).
  if (exists(files.providers) && read(files.providers) === t.providersV1(imp(files.providers, files.config)) && read(files.providers) !== providersSource) {
    if (!options.dryRun) fs.writeFileSync(files.providers, providersSource);
    actions.push({ kind: 'overwritten', file: rel(files.providers), note: 'upgraded: content is now loaded on the server (SEO)' });
  } else {
    writeNew(files.providers, providersSource);
  }
  writeNew(files.adminPage, t.adminPage(imp(files.adminPage, files.config)));

  // The small admin shell is only ours to manage when this tool made it (or the area is new).
  const adminLayoutSource = t.adminLayout({ href: adminUrl });
  const adminLayoutIsOurs = exists(files.adminLayout) && read(files.adminLayout) === adminLayoutSource;
  if (!adminRootExisted || adminLayoutIsOurs) {
    writeNew(files.adminLayout, adminLayoutSource);
  }

  if (options.example) {
    writeNew(files.exampleJson, t.exampleContentJson);
    writeNew(files.exampleView, t.exampleView(jsonSpec(files.exampleView)));
    writeNew(
      files.examplePage,
      t.examplePage({ viewImport: imp(files.examplePage, files.exampleView) })
    );
  }

  // ------------------------------------------------------------------ edit existing files
  const layoutFile = firstExisting(appDir, ['layout.tsx', 'layout.jsx', 'layout.js']);
  if (!layoutFile) {
    manual.push(`Wrap your root layout's {children} with <CmsProviders> (from ${imp(path.join(appDir, 'layout.tsx'), files.providers)}).`);
  } else {
    const result = wrapLayoutWithProviders(read(layoutFile), imp(layoutFile, files.providers));
    if (result.status === 'changed') modify(layoutFile, result.source, 'wrapped {children} with <CmsProviders>');
    else if (result.status === 'already') actions.push({ kind: 'unchanged', file: rel(layoutFile), note: 'already wrapped' });
    else {
      actions.push({ kind: 'skipped', file: rel(layoutFile), note: result.reason });
      manual.push(
        `In ${rel(layoutFile)}: import { CmsProviders } from '${imp(layoutFile, files.providers)}' and wrap {children} inside <body> with <CmsProviders>.`
      );
    }
  }

  // Tailwind @source line, in the stylesheet the layout imports.
  const cssFile = findGlobalCss(appDir, layoutFile, alias);
  const libDir = findLibraryDir(root) ?? path.join(root, 'node_modules', '@brainicon', 'visual-cms');
  if (!cssFile) {
    manual.push(
      `Add this line to your global CSS, below @import "tailwindcss";   @source "<path to node_modules>/${LIB}/dist";`
    );
  } else {
    const relDist = path.relative(path.dirname(cssFile), path.join(libDir, 'dist')).split(path.sep).join('/');
    const result = addTailwindSource(read(cssFile), relDist.startsWith('.') ? relDist : `./${relDist}`);
    if (result.status === 'changed') modify(cssFile, result.source, 'added Tailwind @source line');
    else if (result.status === 'already') actions.push({ kind: 'unchanged', file: rel(cssFile), note: '@source already present' });
    else {
      actions.push({ kind: 'skipped', file: rel(cssFile), note: result.reason });
      manual.push(`In ${rel(cssFile)}: add   @source "${relDist}";   (Tailwind needs it to style the CMS screens; ${result.reason}).`);
    }
  }

  // .gitignore for the file storage.
  const gitignore = path.join(root, '.gitignore');
  if (options.backend === 'files' && exists(gitignore)) {
    const result = addGitignoreEntries(read(gitignore), ['.cms', 'public/cms-uploads']);
    if (result.added.length > 0) modify(gitignore, result.source, `ignored ${result.added.join(', ')}`);
    else actions.push({ kind: 'unchanged', file: '.gitignore' });
  }

  // Middleware that may redirect the preview iframe.
  const middleware = firstExisting(base, ['middleware.ts', 'middleware.js']) ?? firstExisting(root, ['middleware.ts', 'middleware.js']);
  if (middleware) {
    manual.push(
      `${rel(middleware)} exists. If it redirects visitors (login wall, locale), let the CMS preview through: ` +
        `import { isCmsPreviewRequest } from '${LIB}/next' and skip the redirect when isCmsPreviewRequest(request, { studioPath: '${adminUrl}' }).`
    );
  }

  // ------------------------------------------------------------------ dependencies
  const missing = [...(deps[LIB] ? [] : [LIB]), ...PEERS.filter((p) => !deps[p])];
  const packageManager = detectPackageManager(root);
  const installed: string[] = [];
  let installCommand: string | null = null;
  if (missing.length > 0) {
    installCommand = `${packageManager} ${installArgs(packageManager, missing).join(' ')}`;
    if (options.install && !options.dryRun) {
      const result = spawnSync(packageManager, installArgs(packageManager, missing), {
        cwd: root,
        stdio: 'inherit',
        shell: process.platform === 'win32',
      });
      if (result.status === 0) installed.push(...missing);
      else warnings.push(`Installing dependencies failed. Run it yourself:  ${installCommand}`);
    } else if (!options.dryRun) {
      manual.push(`Install the missing dependencies:  ${installCommand}`);
    }
  }

  // ------------------------------------------------------------------ guidance
  if (options.backend === 'files') {
    warnings.push(
      `${rel(files.apiRoute)} only allows editing while running \`next dev\`. Replace its authorize() with a check of your own login before deploying.`
    );
  }
  if (options.backend === 'django') {
    manual.push(
      'Before deploying: set NEXT_PUBLIC_CMS_API_URL to your production API (for example https://api.example.com/api/cms), ' +
        'then run  npx visual-cms doctor --production --api-url <that URL> --frontend-origin <your site URL>  (see the README, "Deploying to production").'
    );
  }
  if (options.backend === 'files') {
    // warned above
  } else if (djangoDir) {
    console.log(`\nSetting up Django in ${djangoDir} ...`);
    const result = runDjangoSetup({ djangoDir, frontendOrigin: options.frontendOrigin ?? 'http://localhost:3000', dryRun: options.dryRun });
    if (!result.ok) {
      warnings.push(`Django setup did not finish: ${result.problem} Do it by hand: see the steps below.`);
      manual.push(...djangoSteps());
    } else if (!result.venv && !options.dryRun) {
      warnings.push(`No virtual environment found next to the Django project, so "${result.python}" from your PATH was used. Check that this is the Python your Django project runs on.`);
    }
  } else {
    manual.push(...djangoSteps());
  }
  if (adminRootExisted && !adminLayoutIsOurs) {
    manual.push(
      `Add the CMS button to your admin menu:  <CmsNavButton href="${adminUrl}" />  (from '${LIB}/admin'; pass as={Link} for client-side navigation), or any plain link.`
    );
  }
  if (!options.example) {
    manual.push('Add your pages to cms.config.ts, then make each page editable with usePageContent() and <CmsSection>. See the README, "Make your pages editable".');
  }

  return {
    actions,
    warnings,
    manual,
    installed,
    installCommand,
    adminUrl,
    exampleUrl: options.example ? '/cms-example' : null,
    packageManager,
    backend: options.backend,
  };
}

function findGlobalCss(appDir: string, layoutFile: string | null, alias: AliasInfo | null): string | null {
  if (layoutFile) {
    const spec = read(layoutFile).match(/import\s+['"]([^'"]+\.css)['"]/)?.[1];
    if (spec) {
      const resolved = spec.startsWith('@/') && alias ? path.join(alias.root, spec.slice(2)) : path.resolve(path.dirname(layoutFile), spec);
      if (exists(resolved)) return resolved;
    }
  }
  return firstExisting(appDir, ['globals.css', 'global.css']);
}

function djangoSteps(): string[] {
  return [
    'Set up the Django side: run   npx visual-cms init --backend django --django-dir <folder with manage.py>   again, ' +
      'or by hand (see django-visual-cms/README.md): pip install django-visual-cms, add "visual_cms" to INSTALLED_APPS, ' +
      'add path("api/cms/", include("visual_cms.urls")) to urls.py, then run python manage.py migrate.',
    'If the site and Django run on different domains, configure django-cors-headers and CSRF_TRUSTED_ORIGINS (see django-visual-cms/README.md).',
  ];
}
