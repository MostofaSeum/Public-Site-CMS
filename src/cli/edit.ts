/**
 * Pure text helpers used by `storio-editor init` to edit existing project files.
 * They never touch the disk, so they are easy to test.
 */
import path from 'node:path';

export type EditStatus = 'changed' | 'already' | 'manual';

export interface EditResult {
  source: string;
  status: EditStatus;
  /** Why a manual edit is needed. */
  reason?: string;
}

const eolOf = (text: string) => (text.includes('\r\n') ? '\r\n' : '\n');

/** Add an import line after the last top-level import (or after leading directives). */
export function addImportLine(source: string, line: string): string {
  const eol = eolOf(source);
  const lines = source.split(/\r?\n/);

  let inImport = false;
  let lastImportLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!inImport && /^import\b/.test(lines[i])) inImport = true;
    // An import statement ends on the line holding the quoted module name.
    if (inImport && /['"][^'"\n]+['"]\s*;?\s*(\/\/.*)?$/.test(lines[i])) {
      lastImportLine = i;
      inImport = false;
    }
  }

  if (lastImportLine >= 0) {
    lines.splice(lastImportLine + 1, 0, line);
  } else {
    let at = 0;
    while (at < lines.length && /^\s*(['"]use [a-z ]+['"];?|\/\/.*|)\s*$/.test(lines[at]) && lines[at].trim() !== '') at++;
    lines.splice(at, 0, line, '');
  }
  return lines.join(eol);
}

/** Wrap the `{children}` inside <body> of the root layout with <CmsProviders>. */
export function wrapLayoutWithProviders(source: string, importSpecifier: string): EditResult {
  if (/\bCmsProviders\b/.test(source)) return { source, status: 'already' };

  const bodyIndex = source.search(/<body[\s>]/);
  if (bodyIndex === -1) {
    return { source, status: 'manual', reason: 'no <body> element found in the layout' };
  }
  const childrenPattern = /\{\s*children\s*\}/g;
  childrenPattern.lastIndex = bodyIndex;
  const match = childrenPattern.exec(source);
  if (!match) {
    return { source, status: 'manual', reason: 'no {children} found inside <body>' };
  }

  const wrapped =
    source.slice(0, match.index) +
    '<CmsProviders>{children}</CmsProviders>' +
    source.slice(match.index + match[0].length);
  return {
    source: addImportLine(wrapped, `import { CmsProviders } from '${importSpecifier}';`),
    status: 'changed',
  };
}

/** Add the Tailwind v4 `@source` line that lets Tailwind see the library's class names. */
export function addTailwindSource(css: string, relativeDistPath: string): EditResult {
  if (/storio-elements-editor\/dist/.test(css)) return { source: css, status: 'already' };

  const importMatch = css.match(/@import\s+(["'])tailwindcss\1[^;\n]*;/);
  if (!importMatch || importMatch.index === undefined) {
    const reason = /@tailwind\s+base/.test(css)
      ? 'this looks like Tailwind CSS v3; the library needs Tailwind v4'
      : 'no `@import "tailwindcss";` found in this file';
    return { source: css, status: 'manual', reason };
  }

  const eol = eolOf(css);
  const end = importMatch.index + importMatch[0].length;
  return {
    source: `${css.slice(0, end)}${eol}@source "${relativeDistPath}";${css.slice(end)}`,
    status: 'changed',
  };
}

/** Append entries that are not yet listed in a .gitignore. Returns the new text and what was added. */
export function addGitignoreEntries(text: string, entries: string[]): { source: string; added: string[] } {
  const present = new Set(text.split(/\r?\n/).map((l) => l.trim().replace(/^\//, '').replace(/\/$/, '')));
  const added = entries.filter((e) => !present.has(e.replace(/\/$/, '')));
  if (added.length === 0) return { source: text, added };

  const eol = eolOf(text);
  const prefix = text.length === 0 || text.endsWith('\n') ? '' : eol;
  return {
    source: `${text}${prefix}${eol}# storio-editor content and uploads${eol}${added.join(eol)}${eol}`,
    added,
  };
}

export interface AliasInfo {
  /** Absolute folder that the "@/" alias points to. */
  root: string;
}

/** Find the `"@/*"` path alias in a tsconfig (comments allowed). */
export function detectAlias(tsconfigText: string, projectRoot: string): AliasInfo | null {
  const match = tsconfigText.match(/"@\/\*"\s*:\s*\[\s*"([^"]+)"/);
  if (!match) return null;
  const baseUrl = tsconfigText.match(/"baseUrl"\s*:\s*"([^"]+)"/)?.[1];
  const base = baseUrl ? path.resolve(projectRoot, baseUrl) : projectRoot;
  return { root: path.resolve(base, match[1].replace(/\/?\*$/, '')) };
}

const toPosix = (p: string) => p.split(path.sep).join('/');

/**
 * Import specifier for `target` as written inside `from`, using the "@/" alias
 * when the target lies under it and a relative path otherwise.
 */
export function importSpecifier(from: string, target: string, alias: AliasInfo | null): string {
  const withoutExt = /\.(ts|tsx)$/.test(target) ? target.replace(/\.(ts|tsx)$/, '') : target;

  if (alias) {
    const inside = path.relative(alias.root, withoutExt);
    if (inside && !inside.startsWith('..') && !path.isAbsolute(inside)) return `@/${toPosix(inside)}`;
  }
  const relative = toPosix(path.relative(path.dirname(from), withoutExt));
  return relative.startsWith('.') ? relative : `./${relative}`;
}
