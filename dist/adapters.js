"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/adapters/index.ts
var adapters_exports = {};
__export(adapters_exports, {
  CmsAuthError: () => CmsAuthError,
  CmsRequestError: () => CmsRequestError,
  cmsAuth: () => cmsAuth,
  djangoAdapter: () => djangoAdapter,
  memoryAdapter: () => memoryAdapter,
  restAdapter: () => restAdapter
});
module.exports = __toCommonJS(adapters_exports);

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

// src/adapters/auth.ts
var CmsAuthError = class extends Error {
  constructor(message, status) {
    super(message);
    this.name = "CmsAuthError";
    this.status = status;
  }
};
function cmsAuth(options) {
  const base = options.baseUrl.replace(/\/+$/, "");
  const key = options.storageKey ?? "visual-cms-token";
  const doFetch = options.fetch ?? ((...args) => fetch(...args));
  let memory = null;
  const storage = (() => {
    const wanted = options.storage;
    if (wanted === null || wanted === "memory") return null;
    if (wanted && typeof wanted === "object") return wanted;
    try {
      if (typeof window === "undefined") return null;
      return wanted === "session" ? window.sessionStorage : window.localStorage;
    } catch {
      return null;
    }
  })();
  const read = () => {
    let stored = memory;
    if (!stored && storage) {
      try {
        const raw = storage.getItem(key);
        stored = raw ? JSON.parse(raw) : null;
      } catch {
        stored = null;
      }
    }
    if (!stored || typeof stored.token !== "string" || typeof stored.expiresAt !== "number" || stored.expiresAt <= Date.now()) {
      if (stored) clear();
      return null;
    }
    return stored;
  };
  const write = (value) => {
    memory = value;
    try {
      storage?.setItem(key, JSON.stringify(value));
    } catch {
    }
  };
  function clear() {
    memory = null;
    try {
      storage?.removeItem(key);
    } catch {
    }
  }
  const headers = () => {
    const stored = read();
    return stored ? { Authorization: `Bearer ${stored.token}` } : {};
  };
  const detail = async (res, fallback) => {
    try {
      const body = await res.json();
      return body.detail || fallback;
    } catch {
      return fallback;
    }
  };
  return {
    headers,
    getToken: () => read()?.token ?? null,
    logout: clear,
    async login(username, password) {
      let res;
      try {
        res = await doFetch(`${base}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ username, password }),
          cache: "no-store"
        });
      } catch {
        throw new CmsAuthError("Cannot reach the server. Check your connection and try again.", 0);
      }
      if (!res.ok) {
        const fallback = res.status === 404 ? "Token login is not available on this server (update django-visual-cms)." : `Sign in failed (status ${res.status}).`;
        throw new CmsAuthError(await detail(res, fallback), res.status);
      }
      const body = await res.json();
      write({ token: body.token, expiresAt: Date.now() + Math.max(0, body.expiresIn - 30) * 1e3 });
      return body.user;
    },
    async check() {
      if (!read()) return null;
      const res = await doFetch(`${base}/auth/me`, {
        credentials: "omit",
        headers: { Accept: "application/json", ...headers() },
        cache: "no-store"
      });
      if (res.status === 401 || res.status === 403) {
        clear();
        return null;
      }
      if (!res.ok) throw new CmsAuthError(`Could not check the sign-in (status ${res.status}).`, res.status);
      return (await res.json()).user;
    }
  };
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CmsAuthError,
  CmsRequestError,
  cmsAuth,
  djangoAdapter,
  memoryAdapter,
  restAdapter
});
