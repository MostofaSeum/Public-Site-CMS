import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SKIP = new Set(['venv', '.venv', 'env', 'node_modules', '.git', '__pycache__', 'site-packages', 'build', 'dist', '.next']);

export interface DjangoProject {
  /** Folder that holds manage.py. */
  dir: string;
}

/** Find the folder with manage.py: the folder itself, or one or two levels below it. */
export function findDjangoProject(start: string): DjangoProject | null {
  const root = path.resolve(start);
  if (fs.existsSync(path.join(root, 'manage.py'))) return { dir: root };
  const found: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 2) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || SKIP.has(entry.name) || entry.name.startsWith('.')) continue;
      const child = path.join(dir, entry.name);
      if (fs.existsSync(path.join(child, 'manage.py'))) found.push(child);
      else walk(child, depth + 1);
    }
  };
  walk(root, 1);
  return found.length === 1 ? { dir: found[0] } : null;
}

/** Python of the project's virtual environment, or the one on PATH. */
export function findPython(djangoDir: string): { command: string; venv: boolean } {
  const bin = process.platform === 'win32' ? path.join('Scripts', 'python.exe') : path.join('bin', 'python');
  for (const base of [djangoDir, path.dirname(djangoDir)]) {
    for (const name of ['venv', '.venv', 'env']) {
      const candidate = path.join(base, name, bin);
      if (fs.existsSync(candidate)) return { command: candidate, venv: true };
    }
  }
  return { command: process.platform === 'win32' ? 'python' : 'python3', venv: false };
}

/** Where the Django package sits relative to this file (works from dist/ and from src/cli/). */
export function djangoPackageDir(): string | null {
  for (const rel of [['..', 'django-storio-elements-editor'], ['..', '..', 'django-storio-elements-editor']]) {
    const candidate = path.resolve(__dirname, ...rel);
    if (fs.existsSync(path.join(candidate, 'pyproject.toml'))) return candidate;
  }
  return null;
}

export interface DjangoSetupResult {
  ok: boolean;
  python: string;
  venv: boolean;
  /** What went wrong, when ok is false. */
  problem?: string;
}

/**
 * Install django-storio-elements-editor into the project's Python environment and run its setup
 * command (settings, urls, migration). Output goes straight to the terminal.
 */
export function runDjangoSetup(opts: { djangoDir: string; frontendOrigin: string; dryRun: boolean }): DjangoSetupResult {
  const { command, venv } = findPython(opts.djangoDir);
  const pkgDir = djangoPackageDir();
  if (!pkgDir) {
    return { ok: false, python: command, venv, problem: 'The django-storio-elements-editor folder was not found inside the installed library.' };
  }
  const run = (args: string[], env: NodeJS.ProcessEnv = process.env) =>
    spawnSync(command, args, { cwd: opts.djangoDir, stdio: 'inherit', env, shell: false });

  const probe = spawnSync(command, ['--version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    return { ok: false, python: command, venv, problem: `Could not run Python (${command}). Activate your virtual environment or install Python.` };
  }

  // In a dry run nothing is installed; the setup module needs no Django, so run it from the source folder.
  let env = process.env;
  if (opts.dryRun) {
    env = { ...process.env, PYTHONPATH: [pkgDir, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter) };
  } else {
    const install = run(['-m', 'pip', 'install', '--quiet', '--disable-pip-version-check', pkgDir]);
    if (install.status !== 0) {
      return { ok: false, python: command, venv, problem: `pip could not install django-storio-elements-editor from ${pkgDir}.` };
    }
  }

  const args = ['-m', 'storio_elements_editor', 'setup', '--project', opts.djangoDir, '--frontend-origin', opts.frontendOrigin];
  if (opts.dryRun) args.push('--dry-run');
  const setup = run(args, env);
  if (setup.status !== 0) {
    return { ok: false, python: command, venv, problem: 'The Django setup step reported an error (see the message above).' };
  }
  return { ok: true, python: command, venv };
}
