import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { CmsStorageAdapter, ListOptions, MediaItem, SaveRecordInput, SectionRecord } from '../core/types';

export interface FileStorageOptions {
  /** Folder for the content file. Defaults to ".cms" in the working directory. */
  dir?: string;
  /** Folder uploads are written to. Defaults to "public/cms-uploads" so Next.js serves them. */
  mediaDir?: string;
  /** Public URL prefix of `mediaDir`. Defaults to "/cms-uploads". */
  mediaUrlPrefix?: string;
  /** Largest accepted upload in bytes. Defaults to 5 MB. */
  maxUploadBytes?: number;
}

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif', '.avif']);

interface FileShape {
  records: SectionRecord[];
}

/**
 * Stores content in a JSON file and uploads in a public folder. Good for local
 * development and single-server (VPS/Docker) deployments. It does not work on
 * read-only or multi-instance hosts such as Vercel: use a database adapter there.
 */
export function fileStorage(options: FileStorageOptions = {}): CmsStorageAdapter {
  const dir = path.resolve(options.dir ?? '.cms');
  const file = path.join(dir, 'content.json');
  const mediaDir = path.resolve(options.mediaDir ?? path.join('public', 'cms-uploads'));
  const mediaUrlPrefix = (options.mediaUrlPrefix ?? '/cms-uploads').replace(/\/+$/, '');
  const maxUploadBytes = options.maxUploadBytes ?? 5 * 1024 * 1024;

  // Serialise writes in this process so concurrent saves never overwrite each other.
  let queue: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  };

  async function read(): Promise<FileShape> {
    try {
      const raw = await fs.readFile(file, 'utf8');
      const data = JSON.parse(raw) as Partial<FileShape>;
      return { records: Array.isArray(data.records) ? data.records : [] };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { records: [] };
      throw err;
    }
  }

  async function write(data: FileShape): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
    // Write to a temp file and rename, so a crash never leaves a half-written file.
    const tmp = `${file}.${randomUUID()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tmp, file);
  }

  const visible = (record: SectionRecord, opts?: ListOptions) => opts?.includeDrafts || record.isPublished;

  return {
    async listRecords(page?: string, opts?: ListOptions) {
      const { records } = await read();
      return records.filter((r) => (!page || r.page === page) && visible(r, opts));
    },

    async getRecord(page: string, sectionKey: string, opts?: ListOptions) {
      const { records } = await read();
      const record = records.find((r) => r.page === page && r.sectionKey === sectionKey);
      return record && visible(record, opts) ? record : null;
    },

    saveRecord(input: SaveRecordInput) {
      return exclusive(async () => {
        const data = await read();
        const record: SectionRecord = {
          page: input.page,
          sectionKey: input.sectionKey,
          content: input.content,
          isPublished: input.isPublished,
          updatedAt: new Date().toISOString(),
          updatedBy: input.updatedBy ?? null,
        };
        const index = data.records.findIndex((r) => r.page === input.page && r.sectionKey === input.sectionKey);
        if (index >= 0) data.records[index] = record;
        else data.records.push(record);
        await write(data);
        return record;
      });
    },

    deleteRecord(page: string, sectionKey: string) {
      return exclusive(async () => {
        const data = await read();
        const remaining = data.records.filter((r) => !(r.page === page && r.sectionKey === sectionKey));
        if (remaining.length !== data.records.length) await write({ records: remaining });
      });
    },

    async uploadMedia(files: File[]) {
      await fs.mkdir(mediaDir, { recursive: true });
      const saved: MediaItem[] = [];
      for (const fileItem of files) {
        const ext = path.extname(fileItem.name).toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext)) continue;
        if (fileItem.size > maxUploadBytes) continue;
        // Never trust the client's file name for the path: keep only safe characters.
        const base = path.basename(fileItem.name, ext).replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 60) || 'image';
        const name = `${randomUUID().slice(0, 8)}_${base}${ext}`;
        await fs.writeFile(path.join(mediaDir, name), Buffer.from(await fileItem.arrayBuffer()));
        saved.push({ url: `${mediaUrlPrefix}/${name}`, name: fileItem.name, size: fileItem.size });
      }
      return saved;
    },

    async listMedia() {
      try {
        const entries = await fs.readdir(mediaDir, { withFileTypes: true });
        return entries
          .filter((e) => e.isFile() && ALLOWED_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
          .map((e) => ({ url: `${mediaUrlPrefix}/${e.name}`, name: e.name }));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw err;
      }
    },
  };
}
