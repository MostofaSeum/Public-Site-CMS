import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { CliError, runInit, type Action, type InitOptions, type InitReport } from './init';
import { askMissingOptions } from './prompts';

const HELP = `visual-cms: set up @brainicon/visual-cms in a Next.js project

Usage
  visual-cms init [options]

Options
  --backend <files|django>  Where content is stored (default: files)
                              files   a JSON file inside this Next.js app
                              django  a Django API running django-visual-cms
  --api-url <url>           Django API base URL (default: http://localhost:8000/api/cms)
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
  flags: Map<string, string | true>;
}

function parseArgs(argv: string[]): Parsed {
  const flags = new Map<string, string | true>();
  let command: string | null = null;
  const valueFlags = new Set(['backend', 'api-url', 'admin-path', 'cwd']);
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
      throw new CliError(`Unexpected argument "${arg}". Run with --help.`);
    }
  }
  return { command, flags };
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

function printReport(report: InitReport, dryRun: boolean): void {
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
    const { command, flags } = parseArgs(argv);
    if (flags.has('help') || command === 'help' || (!command && flags.size === 0)) {
      console.log(HELP);
      return 0;
    }
    if (flags.has('version')) {
      console.log(version());
      return 0;
    }
    if (command !== 'init') throw new CliError(`Unknown command "${command}". Run with --help.`);

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
    };

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
