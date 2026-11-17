import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { CliError, runInit, type Action, type InitOptions, type InitReport } from './init';
import { askMissingOptions } from './prompts';
import { runAddPage } from './addPage';
import { checkDjango, checkProject, summarize, type Check } from './doctor';

const HELP = `visual-cms: set up @brainicon/visual-cms in a Next.js project

Usage
  visual-cms init [options]           Set up the library in this project
  visual-cms add-page <key> [options] Create a new editable page (content, view, route, config entry)
  visual-cms doctor [options]         Check the setup and say what to fix

add-page options
  --title <text>            Page title shown in the CMS (default: made from the key)
  --route <path>            Public route (default: /<key>)
  --sections <a,b,c>        Section keys (default: hero,content)

doctor options
  --api-url <url>           Check this Django API instead of the one in cms.config.ts
  --frontend-origin <url>   Origin to test CORS with (default: http://localhost:3000)

init options
  --backend <files|django>  Where content is stored (default: files)
                              files   a JSON file inside this Next.js app
                              django  a Django API running django-visual-cms
  --api-url <url>           Django API base URL (default: http://localhost:8000/api/cms)
  --django-dir <path>       Folder of your Django project (has manage.py). Also sets up Django:
                            installs django-visual-cms, edits settings.py and urls.py (with
                            backups), and runs the migration. Needs --backend django
  --frontend-origin <url>   Where this Next.js site runs, allowed by Django (default: http://localhost:3000)
  --admin-path <path>       Folder of the CMS screen under app/ (default: admin/cms)
                              route groups are allowed: "(admin)/dashboard/cms"
  --no-example              Do not create the example page at /cms-example
  --no-install              Do not install missing dependencies
  --dry-run                 Show what would happen without changing anything
  --force                   Overwrite existing files that differ
  -y, --yes                 Accept defaults, ask nothing
  --cwd <dir>               Project folder (default: current folder)
  -h, --help                Show this help
  -v, --version             Show the version
`;

interface Parsed {
  command: string | null;
  positionals: string[];
  flags: Map<string, string | true>;
}

function parseArgs(argv: string[]): Parsed {
  const flags = new Map<string, string | true>();
  let command: string | null = null;
  const positionals: string[] = [];
  const valueFlags = new Set(['backend', 'api-url', 'admin-path', 'cwd', 'django-dir', 'frontend-origin', 'title', 'route', 'sections']);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-y') flags.set('yes', true);
    else if (arg === '-h') flags.set('help', true);
    else if (arg === '-v') flags.set('version', true);
    else if (arg.startsWith('--')) {
      const [name, inline] = arg.slice(2).split('=', 2);
      if (valueFlags.has(name)) {
        const value = inline ?? argv[++i];
        if (value === undefined || value.startsWith('--')) throw new CliError(`Option --${name} needs a value.`);
        flags.set(name, value);
      } else {
        flags.set(name, true);
      }
    } else if (!command) {
      command = arg;
    } else {
      positionals.push(arg);
    }
  }
  return { command, positionals, flags };
}

const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const paint = (code: number) => (text: string) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
const green = paint(32);
const yellow = paint(33);
const dim = paint(2);
const bold = paint(1);
const red = paint(31);

const SYMBOL: Record<Action['kind'], (s: string) => string> = {
  created: (s) => green(s),
  modified: (s) => green(s),
  overwritten: (s) => yellow(s),
  unchanged: (s) => dim(s),
  skipped: (s) => yellow(s),
};
const LABEL: Record<Action['kind'], string> = {
  created: '+ created    ',
  modified: '~ modified   ',
  overwritten: '! overwritten',
  unchanged: '= unchanged  ',
  skipped: '- skipped    ',
};

async function runDoctor(cwd: string, flags: Map<string, string | true>): Promise<number> {
  const origin = (flags.get('frontend-origin') as string | undefined) ?? 'http://localhost:3000';
  const local = checkProject(path.resolve(cwd));
  const apiUrl = (flags.get('api-url') as string | undefined) ?? local.djangoBaseUrl;
  const checks: Check[] = [...local.checks];
  if (apiUrl) checks.push(...(await checkDjango(apiUrl, origin)));

  const icon = { ok: green('  ok  '), warn: yellow(' warn '), fail: red(' FAIL ') };
  console.log('');
  for (const c of checks) {
    console.log(`${icon[c.level]} ${c.title}`);
    if (c.fix) console.log(dim(`        -> ${c.fix}`));
  }
  const { ok, warn, fail } = summarize(checks);
  console.log('');
  console.log(`${ok} ok, ${warn} warning${warn === 1 ? '' : 's'}, ${fail} problem${fail === 1 ? '' : 's'}.`);
  if (apiUrl) console.log(dim('Not checked: whether you are logged in to Django as a staff user. If saving fails with "Failed to save", log in at your Django admin first.'));
  console.log('');
  return fail > 0 ? 1 : 0;
}

function printReport(report: InitReport, dryRun: boolean, showTry = true): void {
  console.log('');
  console.log(bold(dryRun ? 'Dry run: nothing was changed. This is what would happen:' : 'Done.'));
  console.log('');
  for (const action of report.actions) {
    const note = action.note ? dim(`  (${action.note})`) : '';
    console.log(`  ${SYMBOL[action.kind](LABEL[action.kind])} ${action.file}${note}`);
  }
  if (report.installed.length > 0) console.log(`  ${green('+ installed   ')} ${report.installed.join(', ')}`);
  else if (report.installCommand && dryRun) console.log(`  ${yellow('~ would run  ')} ${report.installCommand}`);

  if (report.warnings.length > 0) {
    console.log('');
    console.log(yellow('Warnings'));
    for (const w of report.warnings) console.log(`  ! ${w}`);
  }
  if (report.manual.length > 0) {
    console.log('');
    console.log(bold('Still to do by hand'));
    report.manual.forEach((m, i) => console.log(`  ${i + 1}. ${m}`));
  }

  if (!showTry) {
    console.log('');
    return;
  }
  const run = report.packageManager === 'npm' ? 'npm run dev' : `${report.packageManager} dev`;
  console.log('');
  console.log(bold('Try it'));
  console.log(`  1. ${run}`);
  console.log(`  2. Open http://localhost:3000${report.adminUrl}`);
  if (report.exampleUrl) {
    console.log(`  3. The "Example page" (${report.exampleUrl}) shows the pencil buttons. Hover a section and click Edit.`);
    console.log('     Copy its pattern to make your own pages editable.');
  }
  console.log('');
}

async function promptUser(options: InitOptions, given: Set<string>): Promise<InitOptions> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await askMissingOptions(options, given, (question) => rl.question(question));
  } finally {
    rl.close();
  }
}

function version(): string {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    return (JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version: string }).version;
  } catch {
    return 'unknown';
  }
}

function normalizeAdminPath(value: string): string {
  const cleaned = value.replace(/\\/g, '/').split('/').filter(Boolean).join('/');
  const segments = cleaned.split('/');
  // A segment is a folder name, or a route group in parentheses such as "(dashboard)".
  const valid = segments.every((s) => /^[A-Za-z0-9_-]+$/.test(s) || /^\([A-Za-z0-9_-]+\)$/.test(s));
  if (!cleaned || !valid) {
    throw new CliError(
      `Invalid --admin-path "${value}". Use folder names (letters, digits, "-", "_") or route groups like "(admin)", separated by "/" (for example admin/cms or "(admin)/dashboard/cms").`
    );
  }
  return cleaned;
}

export async function main(argv: string[]): Promise<number> {
  try {
    const { command, positionals, flags } = parseArgs(argv);
    if (flags.has('help') || command === 'help' || (!command && flags.size === 0)) {
      console.log(HELP);
      return 0;
    }
    if (flags.has('version')) {
      console.log(version());
      return 0;
    }
    const cwd = typeof flags.get('cwd') === 'string' ? (flags.get('cwd') as string) : process.cwd();

    if (command === 'add-page') {
      if (positionals.length !== 1) throw new CliError('Usage: visual-cms add-page <key>   (for example: visual-cms add-page about)');
      const report = runAddPage({
        cwd,
        key: positionals[0],
        title: flags.get('title') as string | undefined,
        route: flags.get('route') as string | undefined,
        sections: (flags.get('sections') as string | undefined)?.split(',').map((x) => x.trim()).filter(Boolean),
        dryRun: flags.has('dry-run'),
      });
      printReport(
        { actions: report.actions, warnings: report.warnings, manual: [], installed: [], installCommand: null, adminUrl: '', exampleUrl: null, packageManager: 'npm', backend: 'files' },
        flags.has('dry-run'),
        false
      );
      console.log(bold('Next'));
      console.log(`  1. Open ${report.route} to see the page, or the CMS screen to edit it.`);
      console.log(`  2. Replace the placeholder markup in components/*View.tsx with your own, keeping the <CmsSection> wrappers.`);
      console.log(`  3. Edit content/${report.key}.json to set the default text.\n`);
      return 0;
    }

    if (command === 'doctor') return await runDoctor(cwd, flags);

    if (command !== 'init') throw new CliError(`Unknown command "${command}". Run with --help.`);
    if (positionals.length > 0) throw new CliError(`Unexpected argument "${positionals[0]}". Run with --help.`);

    const backendFlag = flags.get('backend');
    if (backendFlag !== undefined && backendFlag !== 'files' && backendFlag !== 'django') {
      throw new CliError('--backend must be "files" or "django".');
    }

    const given = new Set(flags.keys());
    let options: InitOptions = {
      cwd: typeof flags.get('cwd') === 'string' ? (flags.get('cwd') as string) : process.cwd(),
      backend: (backendFlag as 'files' | 'django' | undefined) ?? 'files',
      apiUrl: (flags.get('api-url') as string | undefined) ?? 'http://localhost:8000/api/cms',
      adminPath: normalizeAdminPath((flags.get('admin-path') as string | undefined) ?? 'admin/cms'),
      example: !flags.has('no-example'),
      install: !flags.has('no-install'),
      dryRun: flags.has('dry-run'),
      force: flags.has('force'),
      djangoDir: (flags.get('django-dir') as string | undefined) ?? null,
      frontendOrigin: (flags.get('frontend-origin') as string | undefined) ?? 'http://localhost:3000',
    };
    // Passing --django-dir implies the Django backend.
    if (options.djangoDir && backendFlag === undefined) options.backend = 'django';

    const interactive = Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY) && !flags.has('yes');
    if (interactive) {
      options = await promptUser(options, given);
      options.adminPath = normalizeAdminPath(options.adminPath);
    }

    printReport(runInit(options), options.dryRun);
    return 0;
  } catch (error) {
    if (error instanceof CliError) {
      console.error(red(`Error: ${error.message}`));
      return 1;
    }
    throw error;
  }
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    console.error(error);
    process.exitCode = 1;
  }
);
