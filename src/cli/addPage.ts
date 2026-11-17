import fs from 'node:fs';
import path from 'node:path';
import { addImportLine, detectAlias, importSpecifier, type AliasInfo } from './edit';
import { CliError, type Action } from './init';

export interface AddPageOptions {
  cwd: string;
  /** Page key, e.g. "about". Letters, digits, "-" and "_"; starts with a letter. */
  key: string;
  title?: string;
  /** Public route, default "/<key>". */
  route?: string;
  /** Section keys, default hero + content. */
  sections?: string[];
  dryRun: boolean;
}

export interface AddPageReport {
  actions: Action[];
  warnings: string[];
  route: string;
  key: string;
}

const exists = (p: string) => fs.existsSync(p);
const read = (p: string) => fs.readFileSync(p, 'utf8');
const KEY = /^[a-z][a-z0-9_-]*$/;
const RESERVED = new Set(['default', 'class', 'new', 'function', 'var', 'const', 'let', 'content', 'initialData']);

const pascal = (key: string) =>
  key
    .split(/[-_]/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('');
const titleCase = (key: string) => pascal(key).replace(/([a-z0-9])([A-Z])/g, '$1 $2');

/** A safe JS identifier for a section or page key. */
function camel(key: string): string {
  const p = pascal(key);
  const c = p[0].toLowerCase() + p.slice(1);
  return RESERVED.has(c) ? `${c}Data` : c;
}

/** Index of the "]" that closes the array opened at `open` (strings and comments are skipped). */
export function closingBracket(source: string, open: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
    } else if (ch === '/' && source[i + 1] === '/') {
      const nl = source.indexOf('\n', i);
      if (nl === -1) return -1;
      i = nl;
    } else if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      if (end === -1) return -1;
      i = end + 1;
    } else if (ch === "'" || ch === '"' || ch === '`') quote = ch;
    else if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Add a page entry as the last item of the `pages: [ ... ]` array in cms.config.ts. */
export function addPageEntry(
  source: string,
  entry: string,
  key: string
): { source: string; status: 'changed' | 'already' | 'manual'; reason?: string } {
  if (new RegExp(`key:\\s*['"]${key}['"]`).test(source)) return { source, status: 'already' };
  const match = /\bpages\s*:\s*\[/.exec(source);
  if (!match) return { source, status: 'manual', reason: 'no "pages: [" list found' };
  const open = match.index + match[0].length - 1;
  const close = closingBracket(source, open);
  if (close === -1) return { source, status: 'manual', reason: 'could not find the end of the pages list' };

  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const before = source.slice(0, close).replace(/\s+$/, '');
  const inner = before.slice(open + 1);
  const hasItems = inner.split(/\r?\n/).some((l) => l.trim() && !l.trim().startsWith('//'));
  const comma = hasItems && !before.endsWith(',') ? ',' : '';
  const indented = entry
    .split('\n')
    .map((l) => `    ${l}`)
    .join(eol);
  return { source: `${before}${comma}${eol}${indented},${eol}  ${source.slice(close)}`, status: 'changed' };
}

export function runAddPage(options: AddPageOptions): AddPageReport {
  const root = path.resolve(options.cwd);
  const actions: Action[] = [];
  const warnings: string[] = [];
  const rel = (p: string) => path.relative(root, p).split(path.sep).join('/');

  if (!KEY.test(options.key)) {
    throw new CliError(`Invalid page key "${options.key}". Use lowercase letters, digits, "-" or "_", starting with a letter (for example "about" or "pricing-plans").`);
  }
  const route = (options.route ?? `/${options.key}`).replace(/\/+$/, '') || '/';
  if (!/^\/([A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*)?$/.test(route)) {
    throw new CliError(`Invalid route "${options.route}". Use plain path segments, for example /about or /company/team.`);
  }
  const sections = options.sections?.length ? options.sections : ['hero', 'content'];
  for (const s of sections) {
    if (!KEY.test(s)) throw new CliError(`Invalid section key "${s}". Use lowercase letters, digits, "-" or "_", starting with a letter.`);
  }
  if (new Set(sections).size !== sections.length) throw new CliError('Section keys must be unique.');

  const srcApp = path.join(root, 'src', 'app');
  const appDir = exists(srcApp) ? srcApp : exists(path.join(root, 'app')) ? path.join(root, 'app') : null;
  if (!appDir) throw new CliError('No app/ folder found. Run this from the root of your Next.js App Router project.');
  const base = appDir === srcApp ? path.join(root, 'src') : root;

  const configFile = [path.join(base, 'cms.config.ts'), path.join(root, 'cms.config.ts')].find(exists);
  if (!configFile) throw new CliError('cms.config.ts not found. Run `npx visual-cms init` first.');
  const storageFile = path.join(base, 'lib', 'cms-storage.ts');
  if (!exists(storageFile)) throw new CliError('lib/cms-storage.ts not found. Run `npx visual-cms init` first.');

  const tsconfig = path.join(root, 'tsconfig.json');
  const alias: AliasInfo | null = exists(tsconfig) ? detectAlias(read(tsconfig), root) : null;

  const name = pascal(options.key);
  const pageTitle = options.title ?? titleCase(options.key);
  const jsonFile = path.join(base, 'content', `${options.key}.json`);
  const viewFile = path.join(base, 'components', `${name}View.tsx`);
  const pageFile = path.join(appDir, ...route.split('/').filter(Boolean), 'page.tsx');

  const conflicts = [jsonFile, viewFile, pageFile].filter(exists);
  if (conflicts.length > 0) {
    throw new CliError(
      `Not creating the page: ${conflicts.map(rel).join(', ')} already exist${conflicts.length === 1 ? 's' : ''}. ` +
        `Pick another key or route, or make that page editable by hand (see the README, "Make your pages editable").`
    );
  }

  const imp = (from: string, target: string) => importSpecifier(from, target, alias);
  const write = (file: string, content: string) => {
    if (!options.dryRun) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    }
    actions.push({ kind: 'created', file: rel(file) });
  };

  // content/<key>.json: one object per section, placeholder text to replace.
  const json: Record<string, unknown> = {};
  for (const s of sections) json[s] = { title: `${titleCase(s)} title`, text: 'Edit this text in the CMS, or in this file.' };
  write(jsonFile, JSON.stringify(json, null, 2) + '\n');

  // components/<Name>View.tsx
  const blocks = sections
    .map(
      (s) => `      <CmsSection sectionKey="${s}" title="${titleCase(s)}">
        <section className="mx-auto max-w-5xl px-6 py-12">
          <h2 className="text-3xl font-bold">{${camel(s)}.title}</h2>
          <p className="mt-3 text-gray-600">{${camel(s)}.text}</p>
        </section>
      </CmsSection>`
    )
    .join('\n\n');
  write(
    viewFile,
    `'use client';

import { CmsSection, usePageContent } from '@brainicon/visual-cms/site';
import type pageDefaults from '${imp(viewFile, jsonFile)}';

type Content = typeof pageDefaults;

export function ${name}View({ initialData }: { initialData: Content }) {
  const { ${sections.map(camel).join(', ')} } = usePageContent<Content>('${options.key}', { initialData });

  return (
    <main>
${blocks}
    </main>
  );
}
`
  );

  // app/<route>/page.tsx
  write(
    pageFile,
    `import { getPageContent } from '@brainicon/visual-cms/next';
import { cms } from '${imp(pageFile, configFile)}';
import { storage } from '${imp(pageFile, storageFile)}';
import { ${name}View } from '${imp(pageFile, viewFile)}';
import type pageDefaults from '${imp(pageFile, jsonFile)}';

// Always read fresh content: it can change at any moment from the CMS.
export const dynamic = 'force-dynamic';

export default async function ${name}Page() {
  const data = await getPageContent<typeof pageDefaults>(cms, '${options.key}', { storage });
  return <${name}View initialData={data} />;
}
`
  );

  // cms.config.ts: import the defaults and register the page.
  const defaultsName = `${camel(options.key)}Defaults`;
  const entry = `{
  key: '${options.key}',
  title: '${pageTitle.replace(/'/g, "\\'")}',
  route: '${route}',
  defaults: ${defaultsName},
  sections: [
${sections.map((s) => `    { key: '${s}', label: '${titleCase(s)}' },`).join('\n')}
  ],
}`;
  const importLine = `import ${defaultsName} from '${imp(configFile, jsonFile)}';`;
  const edited = addPageEntry(read(configFile), entry, options.key);
  if (edited.status === 'changed') {
    if (!options.dryRun) fs.writeFileSync(configFile, addImportLine(edited.source, importLine));
    actions.push({ kind: 'modified', file: rel(configFile), note: `registered page "${options.key}"` });
  } else if (edited.status === 'already') {
    actions.push({ kind: 'unchanged', file: rel(configFile), note: `page "${options.key}" already registered` });
  } else {
    actions.push({ kind: 'skipped', file: rel(configFile), note: edited.reason });
    warnings.push(`Add the page to ${rel(configFile)} by hand. Import:  ${importLine}  and add to pages:  ${entry.replace(/\s+/g, ' ')}`);
  }

  return { actions, warnings, route, key: options.key };
}
