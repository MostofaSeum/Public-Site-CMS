import path from 'node:path';
import { findDjangoProject } from './django';
import type { InitOptions } from './init';

/** Asks one question and returns the typed answer (empty string for just pressing Enter). */
export type Ask = (question: string) => Promise<string>;

/**
 * Fill in the options the user did not pass as flags by asking. `given` holds the
 * flag names that were passed on the command line; those are never asked again.
 */
export async function askMissingOptions(options: InitOptions, given: Set<string>, ask: Ask): Promise<InitOptions> {
  const next = { ...options };

  if (!given.has('backend')) {
    const answer = (
      await ask('Where should content be stored?\n  1) In this Next.js app (JSON file)\n  2) A Django API (django-storio-elements-editor)\n> [1] ')
    )
      .trim()
      .toLowerCase();
    next.backend = answer === '2' || answer === 'django' ? 'django' : 'files';
  }
  if (next.backend === 'django' && !given.has('api-url')) {
    const answer = (await ask(`Django API URL [${next.apiUrl}] `)).trim();
    if (answer) next.apiUrl = answer;
  }
  if (next.backend === 'django' && !given.has('django-dir')) {
    const detected = findDjangoProject(path.dirname(path.resolve(next.cwd)))?.dir ?? null;
    const hint = detected ? `[${detected}]` : '[skip]';
    const answer = (await ask(`Django project folder (has manage.py). The CMS can set Django up for you ${hint} `)).trim();
    if (answer && !['skip', 'n', 'no'].includes(answer.toLowerCase())) next.djangoDir = answer;
    else if (!answer && detected) next.djangoDir = detected;
  }
  if (!given.has('admin-path')) {
    const answer = (await ask(`Route for the CMS screen [${next.adminPath}] `)).trim();
    if (answer) next.adminPath = answer;
  }
  if (!given.has('no-example')) {
    const answer = (await ask('Create an example page at /cms-example? [Y/n] ')).trim().toLowerCase();
    next.example = answer !== 'n' && answer !== 'no';
  }
  return next;
}
