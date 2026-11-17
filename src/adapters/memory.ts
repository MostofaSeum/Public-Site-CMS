import type { CmsStorageAdapter, ListOptions, SaveRecordInput, SectionRecord } from '../core/types';

const keyOf = (page: string, sectionKey: string) => `${page}\u0000${sectionKey}`;

function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

/**
 * Keeps records in memory. Useful for demos, tests and as a reference for
 * writing your own adapter. Content is lost when the process or tab reloads.
 */
export function memoryAdapter(initial: SectionRecord[] = []): CmsStorageAdapter & { dump(): SectionRecord[] } {
  const store = new Map<string, SectionRecord>();
  for (const record of initial) store.set(keyOf(record.page, record.sectionKey), clone(record));

  const visible = (record: SectionRecord, opts?: ListOptions) => opts?.includeDrafts || record.isPublished;

  return {
    async listRecords(page?: string, opts?: ListOptions) {
      return Array.from(store.values())
        .filter((r) => (!page || r.page === page) && visible(r, opts))
        .map(clone);
    },
    async getRecord(page: string, sectionKey: string, opts?: ListOptions) {
      const record = store.get(keyOf(page, sectionKey));
      return record && visible(record, opts) ? clone(record) : null;
    },
    async saveRecord(input: SaveRecordInput) {
      const record: SectionRecord = {
        page: input.page,
        sectionKey: input.sectionKey,
        content: clone(input.content),
        isPublished: input.isPublished,
        updatedAt: new Date().toISOString(),
        updatedBy: input.updatedBy ?? null,
      };
      store.set(keyOf(input.page, input.sectionKey), record);
      return clone(record);
    },
    async deleteRecord(page: string, sectionKey: string) {
      store.delete(keyOf(page, sectionKey));
    },
    dump() {
      return Array.from(store.values()).map(clone);
    },
  };
}
