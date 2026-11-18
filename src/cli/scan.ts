/**
 * `visual-cms scan <file>`: turn an existing page's hardcoded text into CMS content.
 *
 * It parses the file with the project's own TypeScript compiler, finds the page's
 * sections (<header>, <section>, <footer>…), moves every static text and every
 * placeholder/alt attribute into content/<page>.json, replaces them with values read
 * through usePageContent(), wraps each section in <CmsSection>, and registers the page
 * in cms.config.ts. Dynamic code (state, API data, expressions) is never touched.
 *
 * Safety: nothing is written in --dry-run; the original file is backed up; the
 * rewritten file is checked for syntax errors and restored if anything is wrong.
 */
import fs from 'node:fs';
import path from 'node:path';
import { addImportLine, detectAlias, importSpecifier, type AliasInfo } from './edit';
import { addPageEntry } from './addPage';
import { CliError, type Action } from './init';

// The CLI does not bundle TypeScript: it uses the copy installed in the project.
type TS = typeof import('typescript');
type Node = import('typescript').Node;
type SourceFile = import('typescript').SourceFile;
type JsxElementLike = import('typescript').JsxElement | import('typescript').JsxSelfClosingElement;

export interface ScanOptions {
  cwd: string;
  /** File to convert, relative to cwd. */
  file: string;
  /** Page key (default: from the route, "/" is "home"). */
  page?: string;
  /** Public route (default: from the file's place under app/). */
  route?: string;
  title?: string;
  /** Name of the component to convert (default: the default export). */
  component?: string;
  /** Add "use client" when the file does not have it. */
  addUseClient?: boolean;
  dryRun: boolean;
}

export interface ScannedField {
  section: string;
  field: string;
  value: string;
}

export interface ScanReport {
  actions: Action[];
  warnings: string[];
  page: string;
  route: string;
  sections: { key: string; title: string; fields: number }[];
  fields: ScannedField[];
  backup: string | null;
}

const SECTION_TAGS = new Set(['section', 'header', 'footer', 'nav', 'aside', 'main', 'article']);
const CONTAINER_TAGS = new Set(['main', 'article']);
const SKIP_TAGS = new Set(['code', 'pre', 'script', 'style', 'svg', 'kbd', 'samp', 'textarea', 'select', 'option']);
const TEXT_ATTRS = new Set(['placeholder', 'alt']);
const INLINE_TAGS = new Set(['span', 'strong', 'em', 'b', 'i', 'small', 'mark', 'sup', 'sub', 'u']);
const KEY = /^[a-z][a-z0-9_-]*$/;

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', bull: '•', copy: '©', reg: '®',
  trade: '™', mdash: '—', ndash: '–', hellip: '…', laquo: '«', raquo: '»', rarr: '→', larr: '←',
  middot: '·', times: '×', deg: '°', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
};

/** JSX text value as React renders it, or null when it holds an entity we do not know. */
export function jsxTextValue(raw: string): string | null {
  const lines = raw.split(/\r?\n/);
  const parts: string[] = [];
  lines.forEach((line, i) => {
    let l = line.replace(/\t/g, ' ');
    if (i > 0) l = l.replace(/^ +/, '');
    if (i < lines.length - 1) l = l.replace(/ +$/, '');
    if (l) parts.push(l);
  });
  let text = lines.length > 1 ? parts.join(' ') : raw;
  let unknown = false;
  text = text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, name: string) => {
    if (name[0] === '#') return String.fromCodePoint(name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10));
    const found = ENTITIES[name.toLowerCase()];
    if (found === undefined) unknown = true;
    return found ?? m;
  });
  return unknown ? null : text.trim();
}

const words = (s: string) => s.replace(/['’]/g, '').split(/[^A-Za-z0-9]+/).filter(Boolean);
export function toKey(s: string, fallback: string): string {
  const w = words(s).slice(0, 3).map((x) => x.toLowerCase());
  const key = w.map((x, i) => (i === 0 ? x : x[0].toUpperCase() + x.slice(1))).join('');
  return /^[a-z][A-Za-z0-9]*$/.test(key) && key.length <= 32 ? key : fallback;
}
const titleCase = (key: string) => key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

function loadTypeScript(root: string): TS {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(require.resolve('typescript', { paths: [root] })) as TS;
  } catch {
    throw new CliError('TypeScript is not installed in this project (npm install -D typescript). The scan command uses it to read your code safely.');
  }
}

/** Elements that may only contain plain text, so a field wrapper cannot go inside them. */
const PLAIN_TEXT_TAGS = new Set(['title']);

export function runScan(options: ScanOptions): ScanReport {
  const root = path.resolve(options.cwd);
  const ts = loadTypeScript(root);
  const rel = (p: string) => path.relative(root, p).split(path.sep).join('/');
  const file = path.resolve(root, options.file);
  if (!fs.existsSync(file)) throw new CliError(`File not found: ${options.file}`);
  if (!/\.(tsx|jsx)$/.test(file)) throw new CliError('scan works on .tsx and .jsx files.');
  const original = fs.readFileSync(file, 'utf8');
  if (/usePageContent\s*[<(]/.test(original)) {
    throw new CliError(`${rel(file)} already uses usePageContent, so it looks converted already. Edit it by hand, or restore the original first.`);
  }

  // ---------------------------------------------------------------- project layout
  const srcApp = path.join(root, 'src', 'app');
  const appDir = fs.existsSync(srcApp) ? srcApp : fs.existsSync(path.join(root, 'app')) ? path.join(root, 'app') : null;
  if (!appDir) throw new CliError('No app/ folder found. Run this from the root of your Next.js App Router project.');
  const base = appDir === srcApp ? path.join(root, 'src') : root;
  const configFile = [path.join(base, 'cms.config.ts'), path.join(root, 'cms.config.ts')].find((p) => fs.existsSync(p));
  if (!configFile) throw new CliError('cms.config.ts not found. Run `npx visual-cms init` first.');
  const tsconfig = path.join(root, 'tsconfig.json');
  const alias: AliasInfo | null = fs.existsSync(tsconfig) ? detectAlias(fs.readFileSync(tsconfig, 'utf8'), root) : null;

  const route = options.route ?? routeFromFile(appDir, file);
  if (!route) throw new CliError(`${rel(file)} is not a page under app/. Pass --route (the URL that shows it) and --page (a key such as "home").`);
  const pageKey = options.page ?? (route === '/' ? 'home' : route.slice(1).replace(/\//g, '-').toLowerCase());
  if (!KEY.test(pageKey)) throw new CliError(`Invalid page key "${pageKey}". Pass --page with lowercase letters, digits, "-" or "_".`);
  const jsonFile = path.join(base, 'content', `${pageKey}.json`);
  if (fs.existsSync(jsonFile)) throw new CliError(`${rel(jsonFile)} already exists. Pass another --page, or delete that file first.`);
  const configText = fs.readFileSync(configFile, 'utf8');
  if (new RegExp(`key:\\s*['"]${pageKey}['"]`).test(configText)) {
    throw new CliError(`A page with key "${pageKey}" is already in ${rel(configFile)}. Pass another --page.`);
  }

  // ---------------------------------------------------------------- parse
  const sf = ts.createSourceFile(file, original, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.JSX);
  const warnings: string[] = [];
  const hasUseClient = sf.statements.some(
    (s, i) => i < 3 && ts.isExpressionStatement(s) && ts.isStringLiteral(s.expression) && s.expression.text === 'use client'
  );
  if (!hasUseClient && !options.addUseClient) {
    throw new CliError(
      `${rel(file)} is a Server Component (no "use client"). The CMS reads content with a React hook, so either move the page's markup into a ` +
        `client component and scan that file (with --page and --route), or pass --add-use-client if this page uses no server-only code ` +
        `(no async component, no metadata export, no database or fs access).`
    );
  }
  const fn = findComponent(ts, sf, options.component);
  if (!fn) throw new CliError(options.component ? `Component "${options.component}" not found in ${rel(file)}.` : `No default-exported component found in ${rel(file)}. Pass --component <Name>.`);
  if (!hasUseClient) {
    const isAsync = fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
    const exportsMetadata = /export\s+(const\s+metadata|(async\s+)?function\s+generateMetadata)/.test(original);
    if (isAsync || exportsMetadata) throw new CliError(`${rel(file)} is async or exports metadata, so it must stay a Server Component. Move its markup into a client component and scan that file.`);
  }
  const rootJsx = findReturnedJsx(ts, fn);
  if (!rootJsx) throw new CliError(`Could not find the JSX that ${rel(file)} returns.`);

  // Identifiers already used in the file, so the names we add never clash.
  const used = new Set<string>();
  const collect = (n: Node) => {
    if (ts.isIdentifier(n)) used.add(n.text);
    ts.forEachChild(n, collect);
  };
  collect(sf);
  const freeName = (wanted: string[]) => wanted.find((w) => !used.has(w)) ?? `${wanted[0]}${Date.now() % 1000}`;
  const contentVar = freeName(['cmsText', 'cmsContent', 'pageCmsText']);
  const typeName = freeName(['CmsPageText', 'CmsPageContent']);
  const defaultsName = freeName(['cmsPageDefaults', 'cmsDefaults']);

  // ---------------------------------------------------------------- sections
  const tagName = (el: JsxElementLike) => {
    const t = ts.isJsxElement(el) ? el.openingElement.tagName : el.tagName;
    return t.getText(sf);
  };
  const attrsOf = (el: JsxElementLike) => (ts.isJsxElement(el) ? el.openingElement.attributes : el.attributes);
  const attr = (el: JsxElementLike, name: string) => {
    for (const p of attrsOf(el).properties) {
      if (ts.isJsxAttribute(p) && p.name.getText(sf) === name && p.initializer && ts.isStringLiteral(p.initializer)) return p.initializer.text;
    }
    return null;
  };
  const isElement = (n: Node): n is JsxElementLike => ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n);
  const hasSectionInside = (n: Node): boolean => {
    let found = false;
    const walk = (c: Node) => {
      if (found) return;
      if (isElement(c) && SECTION_TAGS.has(tagName(c))) found = true;
      else ts.forEachChild(c, walk);
    };
    ts.forEachChild(n, walk);
    return found;
  };

  const containsTag = (n: Node, wanted: string): boolean => {
    let found = false;
    const walk = (c: Node) => {
      if (found) return;
      if (isElement(c) && tagName(c) === wanted) found = true;
      else ts.forEachChild(c, walk);
    };
    walk(n);
    return found;
  };

  const sections: JsxElementLike[] = [];
  const findSections = (n: Node) => {
    if (isElement(n)) {
      const tag = tagName(n);
      if (SECTION_TAGS.has(tag) && !(CONTAINER_TAGS.has(tag) && hasSectionInside(n))) {
        sections.push(n);
        return;
      }
    }
    // Do not look inside callbacks (list items are not page sections).
    if (ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isCallExpression(n)) return;
    ts.forEachChild(n, findSections);
  };
  findSections(rootJsx);
  if (sections.length === 0) {
    // No semantic tags: use the root's direct child elements, or the root itself.
    const kids = ts.isJsxElement(rootJsx) || ts.isJsxFragment(rootJsx) ? rootJsx.children.filter(isElement) : [];
    if (kids.length > 0) sections.push(...kids);
    else if (isElement(rootJsx)) sections.push(rootJsx);
  }
  if (sections.length === 0) throw new CliError(`No sections found in ${rel(file)}.`);

  // ---------------------------------------------------------------- texts
  interface Edit { start: number; end: number; text: string; order: number }
  const edits: Edit[] = [];
  const content: Record<string, Record<string, string>> = {};
  const fields: ScannedField[] = [];
  const sectionInfo: { key: string; title: string; fields: number }[] = [];
  const sectionKeys = new Set<string>();

  const fieldBase = (tag: string) => {
    if (tag === 'h1') return 'title';
    if (tag === 'h2') return 'heading';
    if (/^h[3-6]$/.test(tag)) return 'subheading';
    if (tag === 'p') return 'text';
    if (tag === 'button') return 'button';
    if (tag === 'a' || tag === 'Link') return 'link';
    if (tag === 'label') return 'label';
    if (tag === 'li') return 'item';
    return 'text';
  };

  sections.forEach((section, index) => {
    const tag = tagName(section);
    // Section key: its id, its tag for header/footer/nav, else its first heading.
    let heading: string | null = null;
    const findHeading = (n: Node) => {
      if (heading) return;
      if (isElement(n) && /^h[1-6]$/.test(tagName(n)) && ts.isJsxElement(n)) {
        const t = n.children.filter(ts.isJsxText).map((c) => jsxTextValue(c.getText(sf)) ?? '').join(' ').trim();
        if (t) heading = t;
      }
      ts.forEachChild(n, findHeading);
    };
    findHeading(section);
    const id = attr(section, 'id');
    let key =
      (id && toKey(id, '')) ||
      (['header', 'footer', 'nav'].includes(tag) ? tag : '') ||
      (tag === 'section' && !sectionKeys.has('hero') && containsTag(section, 'h1') ? 'hero' : '') ||
      (heading ? toKey(heading, '') : '') ||
      `section${index + 1}`;
    while (sectionKeys.has(key)) key = `${key}${index + 1}`;
    sectionKeys.add(key);

    const values: Record<string, string> = {};
    const fieldNames = new Set<string>();
    const nextField = (b: string) => {
      let name = b;
      for (let i = 2; fieldNames.has(name); i++) name = `${b}${i}`;
      fieldNames.add(name);
      return name;
    };
    const ref = (field: string) => `${contentVar}.${key}.${field}`;

    const walk = (n: Node, skip: boolean, parentTag: string) => {
      if (isElement(n)) {
        const t = tagName(n);
        const ignored = skip || SKIP_TAGS.has(t) || attrsOf(n).properties.some((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === 'data-cms-ignore');
        if (!ignored) {
          for (const p of attrsOf(n).properties) {
            if (!ts.isJsxAttribute(p) || !p.initializer || !ts.isStringLiteral(p.initializer)) continue;
            const name = p.name.getText(sf);
            const value = p.initializer.text;
            if (!TEXT_ATTRS.has(name) || !/\p{L}/u.test(value)) continue;
            const field = nextField(name);
            values[field] = value;
            edits.push({ start: p.initializer.getStart(sf), end: p.initializer.end, text: `{${ref(field)}}`, order: 0 });
          }
        }
        // Inline tags (a highlighted word in a heading) take the name of the block around them.
        const inline = INLINE_TAGS.has(t) && parentTag !== tag;
        ts.forEachChild(n, (c) => walk(c, ignored, inline ? parentTag : t));
        return;
      }
      if (ts.isJsxText(n) && !skip) {
        const raw = sf.text.slice(n.pos, n.end);
        const value = jsxTextValue(raw);
        if (value && /\p{L}/u.test(value)) {
          const lead = raw.match(/^\s*/)![0];
          const trail = raw.slice(lead.length).match(/\s*$/)![0];
          const field = nextField(fieldBase(parentTag));
          values[field] = value;
          const parent = n.parent;
          const plainOnly = ts.isJsxElement(parent) && PLAIN_TEXT_TAGS.has(tagName(parent));
          const fieldLabel = titleCase(field).replace(/"/g, '');
          const replacement = plainOnly ? `{${ref(field)}}` : `<CmsField path="${field}" label="${fieldLabel}">{${ref(field)}}</CmsField>`;
          edits.push({ start: n.pos, end: n.end, text: `${lead}${replacement}${trail}`, order: 0 });
        }
        return;
      }
      ts.forEachChild(n, (c) => walk(c, skip, parentTag));
    };
    walk(section, false, tag);

    const count = Object.keys(values).length;
    if (count === 0) return; // nothing editable: leave this block alone
    content[key] = values;
    const title = heading ? (heading as string).slice(0, 40) : titleCase(key);
    sectionInfo.push({ key, title, fields: count });
    for (const [field, value] of Object.entries(values)) fields.push({ section: key, field, value });
    const placement = tag === 'header' || tag === 'nav' ? ' buttonPlacement="fixed"' : '';
    const label = titleCase(key).replace(/"/g, '');
    edits.push({ start: section.getStart(sf), end: section.getStart(sf), text: `<CmsSection sectionKey="${key}" title="${label}"${placement}>`, order: 2 });
    edits.push({ start: section.end, end: section.end, text: `</CmsSection>`, order: 1 });
  });
  if (sectionInfo.length === 0) throw new CliError(`No static text found in ${rel(file)}. Nothing to convert.`);

  // ---------------------------------------------------------------- hook
  const hook = `const ${contentVar} = usePageContent<${typeName}>('${pageKey}');`;
  const body = fn.body!;
  if (ts.isBlock(body)) {
    const firstLine = body.statements[0];
    const indent = firstLine ? sf.text.slice(sf.text.lastIndexOf('\n', firstLine.getStart(sf)) + 1, firstLine.getStart(sf)) : '  ';
    const at = firstLine ? firstLine.getStart(sf) : body.getStart(sf) + 1;
    edits.push({ start: at, end: at, text: firstLine ? `${hook}\n${indent}` : `\n  ${hook}\n`, order: 3 });
  } else {
    edits.push({ start: body.getStart(sf), end: body.getStart(sf), text: `{\n  ${hook}\n  return `, order: 3 });
    edits.push({ start: body.end, end: body.end, text: `;\n}`, order: 0 });
  }

  // ---------------------------------------------------------------- apply (start asc; at the same spot, higher order first)
  edits.sort((a, b) => a.start - b.start || b.order - a.order);
  let out = '';
  let cursor = 0;
  for (const e of edits) {
    if (e.start < cursor) throw new CliError('Internal error: overlapping edits. Nothing was changed.');
    out += sf.text.slice(cursor, e.start) + e.text;
    cursor = e.end;
  }
  out += sf.text.slice(cursor);

  const jsonSpec = importSpecifier(file, jsonFile, alias);
  out = addImportLine(out, `import { CmsField, CmsSection, usePageContent } from '@brainicon/visual-cms/site';`);
  out = addImportLine(out, `import type ${defaultsName} from '${jsonSpec}';`);
  // Type alias after the imports.
  out = out.replace(`import type ${defaultsName} from '${jsonSpec}';`, `import type ${defaultsName} from '${jsonSpec}';\n\ntype ${typeName} = typeof ${defaultsName};`);
  if (!hasUseClient) out = `'use client';\n\n${out}`;

  // ---------------------------------------------------------------- verify before writing
  const check = ts.transpileModule(out, { reportDiagnostics: true, fileName: path.basename(file), compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.Latest } });
  const errors = (check.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  if (errors.length > 0) {
    const msg = ts.flattenDiagnosticMessageText(errors[0].messageText, '\n');
    throw new CliError(`The converted file would not compile (${msg}). Nothing was changed. Please report this file shape.`);
  }

  // ---------------------------------------------------------------- write
  const actions: Action[] = [];
  const entry = `{
  key: '${pageKey}',
  title: '${(options.title ?? (pageKey === 'home' ? 'Home' : titleCase(pageKey.replace(/[-_](.)/g, (_, c: string) => c.toUpperCase())))).replace(/'/g, "\\'")}',
  route: '${route}',
  defaults: ${defaultsName},
  sections: [
${sectionInfo.map((s, i) => `    { key: '${s.key}', label: '${`${i + 1}. ${titleCase(s.key)}`.replace(/'/g, "\\'")}' },`).join('\n')}
  ],
}`;
  const configEdit = addPageEntry(configText, entry, pageKey);
  if (configEdit.status !== 'changed') throw new CliError(`Could not register the page in ${rel(configFile)} (${configEdit.reason ?? configEdit.status}). Nothing was changed.`);
  const newConfig = addImportLine(configEdit.source, `import ${defaultsName} from '${importSpecifier(configFile, jsonFile, alias)}';`);

  let backup: string | null = null;
  if (!options.dryRun) {
    backup = `${file}.visual-cms.bak`;
    if (!fs.existsSync(backup)) fs.writeFileSync(backup, original);
    fs.mkdirSync(path.dirname(jsonFile), { recursive: true });
    fs.writeFileSync(jsonFile, JSON.stringify(content, null, 2) + '\n');
    fs.writeFileSync(file, out);
    fs.writeFileSync(configFile, newConfig);
  }
  actions.push({ kind: 'created', file: rel(jsonFile), note: `${fields.length} texts in ${sectionInfo.length} sections` });
  actions.push({ kind: 'modified', file: rel(file), note: 'texts now come from the CMS; sections wrapped in <CmsSection>, texts in <CmsField>' });
  actions.push({ kind: 'modified', file: rel(configFile), note: `registered page "${pageKey}" (${route})` });
  if (!hasUseClient) warnings.push(`Added "use client" to ${rel(file)}.`);

  return { actions, warnings, page: pageKey, route, sections: sectionInfo, fields, backup: backup ? rel(backup) : null };
}

/** "/about" for app/about/page.tsx; route groups and parallel slots are skipped; null for dynamic or non-page files. */
export function routeFromFile(appDir: string, file: string): string | null {
  const relative = path.relative(appDir, file);
  if (relative.startsWith('..') || !/(^|[\\/])page\.(tsx|jsx)$/.test(relative)) return null;
  const segments = relative.split(/[\\/]/).slice(0, -1).filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith('@'));
  if (segments.some((s) => s.startsWith('['))) return null;
  return `/${segments.join('/')}`;
}

type FunctionLike = import('typescript').FunctionDeclaration | import('typescript').ArrowFunction | import('typescript').FunctionExpression;

function findComponent(ts: TS, sf: SourceFile, name?: string): FunctionLike | null {
  const fromDeclaration = (id: string): FunctionLike | null => {
    for (const s of sf.statements) {
      if (ts.isFunctionDeclaration(s) && s.name?.text === id && s.body) return s;
      if (ts.isVariableStatement(s)) {
        for (const d of s.declarationList.declarations) {
          if (ts.isIdentifier(d.name) && d.name.text === id && d.initializer) {
            let init = d.initializer;
            // memo(...) / forwardRef(...) wrappers
            while (ts.isCallExpression(init) && init.arguments[0]) init = init.arguments[0];
            if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) return init;
          }
        }
      }
    }
    return null;
  };
  if (name) return fromDeclaration(name);
  for (const s of sf.statements) {
    if (ts.isFunctionDeclaration(s) && s.body && s.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) return s;
    if (ts.isExportAssignment(s)) {
      if (ts.isIdentifier(s.expression)) return fromDeclaration(s.expression.text);
      if (ts.isArrowFunction(s.expression) || ts.isFunctionExpression(s.expression)) return s.expression;
    }
  }
  return null;
}

function findReturnedJsx(ts: TS, fn: FunctionLike): Node | null {
  const unwrap = (e: Node): Node => (ts.isParenthesizedExpression(e) ? unwrap(e.expression) : e);
  const isJsx = (e: Node) => ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e) || ts.isJsxFragment(e);
  const body = fn.body!;
  if (!ts.isBlock(body)) {
    const e = unwrap(body);
    return isJsx(e) ? e : null;
  }
  // The last top-level return (early returns are usually loading or error states).
  let found: Node | null = null;
  for (const s of body.statements) {
    if (ts.isReturnStatement(s) && s.expression && isJsx(unwrap(s.expression))) found = unwrap(s.expression);
  }
  return found;
}
