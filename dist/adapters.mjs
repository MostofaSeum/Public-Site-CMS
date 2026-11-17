// src/adapters/rest.ts
var CmsRequestError = class extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.name = "CmsRequestError";
  }
};
var enc = encodeURIComponent;
function restAdapter(options) {
  const base = options.baseUrl.replace(/\/+$/, "");
  const doFetch = options.fetch ?? ((...args) => fetch(...args));
  async function request(path, init = {}, allow404 = false) {
    const extra = typeof options.headers === "function" ? await options.headers() : options.headers;
    const headers = new Headers(extra);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const res = await doFetch(`${base}${path}`, {
      ...init,
      headers,
      credentials: options.credentials ?? "same-origin",
      cache: "no-store"
    });
    if (allow404 && res.status === 404) return null;
    if (!res.ok) {
      let message = `Request failed with status ${res.status}`;
      try {
        const body = await res.json();
        message = body.detail || body.error || message;
      } catch {
      }
      throw new CmsRequestError(message, res.status);
    }
    if (res.status === 204) return null;
    return await res.json();
  }
  const draftsQuery = (opts) => opts?.includeDrafts ? "drafts=1" : "";
  const adapter = {
    async listRecords(page, opts) {
      const params = [page ? `page=${enc(page)}` : "", draftsQuery(opts)].filter(Boolean).join("&");
      const data = await request(`/records${params ? `?${params}` : ""}`);
      return Array.isArray(data) ? data : [];
    },
    async getRecord(page, sectionKey, opts) {
      const q = draftsQuery(opts);
      return request(`/records/${enc(page)}/${enc(sectionKey)}${q ? `?${q}` : ""}`, {}, true);
    },
    async saveRecord(input) {
      const data = await request(`/records/${enc(input.page)}/${enc(input.sectionKey)}`, {
        method: "PUT",
        body: JSON.stringify({ content: input.content, isPublished: input.isPublished })
      });
      if (!data) throw new CmsRequestError("Empty response from server", 500);
      return data;
    },
    async deleteRecord(page, sectionKey) {
      await request(`/records/${enc(page)}/${enc(sectionKey)}`, { method: "DELETE" }, true);
    }
  };
  if (options.media !== false) {
    adapter.listMedia = async () => {
      const data = await request("/media");
      return Array.isArray(data) ? data : [];
    };
    adapter.uploadMedia = async (files) => {
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      const data = await request("/media", { method: "POST", body: form });
      return data?.items ?? [];
    };
  }
  return adapter;
}

// src/adapters/django.ts
var UNSAFE = /* @__PURE__ */ new Set(["POST", "PUT", "PATCH", "DELETE"]);
function djangoAdapter(options) {
  const base = options.baseUrl.replace(/\/+$/, "");
  const credentials = options.credentials ?? "include";
  const baseFetch = options.fetch ?? ((...args) => fetch(...args));
  let token = null;
  const extraHeaders = async () => typeof options.headers === "function" ? await options.headers() : options.headers ?? {};
  const getToken = (refresh = false) => {
    if (!token || refresh) {
      token = (async () => {
        const res = await baseFetch(`${base}/csrf`, {
          credentials,
          headers: { Accept: "application/json", ...await extraHeaders() },
          cache: "no-store"
        });
        if (!res.ok) throw new Error(`Could not get a CSRF token (status ${res.status})`);
        const body = await res.json();
        return body.csrfToken ?? "";
      })().catch((err) => {
        token = null;
        throw err;
      });
    }
    return token;
  };
  const csrfFetch = (async (input, init = {}) => {
    const method = (init.method ?? "GET").toUpperCase();
    if (!UNSAFE.has(method)) return baseFetch(input, init);
    const send = async (refresh) => {
      const headers = new Headers(init.headers);
      headers.set("X-CSRFToken", await getToken(refresh));
      return baseFetch(input, { ...init, headers });
    };
    const res = await send(false);
    return res.status === 403 ? send(true) : res;
  });
  return restAdapter({
    ...options,
    credentials,
    headers: extraHeaders,
    fetch: csrfFetch
  });
}

// src/adapters/memory.ts
var keyOf = (page, sectionKey) => `${page}\0${sectionKey}`;
function clone(value) {
  return value === void 0 ? value : JSON.parse(JSON.stringify(value));
}
function memoryAdapter(initial = []) {
  const store = /* @__PURE__ */ new Map();
  for (const record of initial) store.set(keyOf(record.page, record.sectionKey), clone(record));
  const visible = (record, opts) => opts?.includeDrafts || record.isPublished;
  return {
    async listRecords(page, opts) {
      return Array.from(store.values()).filter((r) => (!page || r.page === page) && visible(r, opts)).map(clone);
    },
    async getRecord(page, sectionKey, opts) {
      const record = store.get(keyOf(page, sectionKey));
      return record && visible(record, opts) ? clone(record) : null;
    },
    async saveRecord(input) {
      const record = {
        page: input.page,
        sectionKey: input.sectionKey,
        content: clone(input.content),
        isPublished: input.isPublished,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedBy: input.updatedBy ?? null
      };
      store.set(keyOf(input.page, input.sectionKey), record);
      return clone(record);
    },
    async deleteRecord(page, sectionKey) {
      store.delete(keyOf(page, sectionKey));
    },
    dump() {
      return Array.from(store.values()).map(clone);
    }
  };
}
export {
  CmsRequestError,
  djangoAdapter,
  memoryAdapter,
  restAdapter
};
