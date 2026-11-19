/**
 * Token login for the django-storio-elements-editor API: lets editors sign in from your own React admin
 * (username + password) instead of Django's login page.
 *
 *   export const cmsLogin = cmsAuth({ baseUrl: 'https://api.example.com/api/cms' });
 *   djangoAdapter({ baseUrl, headers: cmsLogin.headers })
 *
 * The token is kept in localStorage (or the `storage` you pass) and sent as
 * `Authorization: Bearer <token>`. It expires on the server; `logout()` forgets it.
 */

export interface CmsUser {
  username: string;
  name: string;
}

export interface CmsAuthOptions {
  /** Base URL of the django-storio-elements-editor API, the same as the one given to djangoAdapter. */
  baseUrl: string;
  /** Key under which the token is stored. Default: "visual-cms-token". */
  storageKey?: string;
  /**
   * Where to keep the token:
   * - "local" (default): stays until it expires or the editor signs out, even after the browser closes
   * - "session": forgotten when the tab or browser closes (the editor signs in again next time)
   * - "memory" (or `null`): forgotten on every page reload
   * or your own object with getItem/setItem/removeItem.
   */
  storage?: 'local' | 'session' | 'memory' | Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  fetch?: typeof fetch;
}

export interface CmsAuth {
  /** Sign in. Stores the token. Throws CmsAuthError (wrong password, locked out, not an editor...). */
  login(username: string, password: string): Promise<CmsUser>;
  /** Forget the token. */
  logout(): void;
  /** The stored token, or null when there is none or it has expired. */
  getToken(): string | null;
  /**
   * Ask the server whether the stored token may edit. Returns the user, or null when there is
   * no token or the server rejects it (a rejected token is forgotten). A Django session cookie
   * never counts here: editors must sign in through the form. Throws when the server cannot be reached.
   */
  check(): Promise<CmsUser | null>;
  /** Headers to send with every CMS request: pass this to djangoAdapter({ headers }). */
  headers(): Record<string, string>;
}

export class CmsAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'CmsAuthError';
    this.status = status;
  }
}

interface Stored {
  token: string;
  expiresAt: number;
}

export function cmsAuth(options: CmsAuthOptions): CmsAuth {
  const base = options.baseUrl.replace(/\/+$/, '');
  const key = options.storageKey ?? 'visual-cms-token';
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  let memory: Stored | null = null;
  const storage = (() => {
    const wanted = options.storage;
    if (wanted === null || wanted === 'memory') return null;
    if (wanted && typeof wanted === 'object') return wanted;
    try {
      if (typeof window === 'undefined') return null; // server rendering: no browser storage
      return wanted === 'session' ? window.sessionStorage : window.localStorage;
    } catch {
      return null; // blocked storage (private mode): fall back to memory
    }
  })();

  const read = (): Stored | null => {
    let stored: Stored | null = memory;
    if (!stored && storage) {
      try {
        const raw = storage.getItem(key);
        stored = raw ? (JSON.parse(raw) as Stored) : null;
      } catch {
        stored = null;
      }
    }
    if (!stored || typeof stored.token !== 'string' || typeof stored.expiresAt !== 'number' || stored.expiresAt <= Date.now()) {
      if (stored) clear();
      return null;
    }
    return stored;
  };

  const write = (value: Stored) => {
    memory = value;
    try {
      storage?.setItem(key, JSON.stringify(value));
    } catch {
      /* memory copy still works for this tab */
    }
  };

  function clear() {
    memory = null;
    try {
      storage?.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  const headers = (): Record<string, string> => {
    const stored = read();
    return stored ? { Authorization: `Bearer ${stored.token}` } : {};
  };

  const detail = async (res: Response, fallback: string) => {
    try {
      const body = (await res.json()) as { detail?: string };
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
      let res: Response;
      try {
        res = await doFetch(`${base}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ username, password }),
          cache: 'no-store',
        });
      } catch {
        throw new CmsAuthError('Cannot reach the server. Check your connection and try again.', 0);
      }
      if (!res.ok) {
        const fallback = res.status === 404 ? 'Token login is not available on this server (update django-storio-elements-editor).' : `Sign in failed (status ${res.status}).`;
        throw new CmsAuthError(await detail(res, fallback), res.status);
      }
      const body = (await res.json()) as { token: string; expiresIn: number; user: CmsUser };
      // Forget the token a little early so it never expires in the middle of a save.
      write({ token: body.token, expiresAt: Date.now() + Math.max(0, body.expiresIn - 30) * 1000 });
      return body.user;
    },

    async check() {
      // Only a token from the sign-in form counts. A leftover Django admin session
      // cookie must not let anyone past the sign-in page, so cookies are never sent here.
      if (!read()) return null;
      const res = await doFetch(`${base}/auth/me`, {
        credentials: 'omit',
        headers: { Accept: 'application/json', ...headers() },
        cache: 'no-store',
      });
      if (res.status === 401 || res.status === 403) {
        clear();
        return null;
      }
      if (!res.ok) throw new CmsAuthError(`Could not check the sign-in (status ${res.status}).`, res.status);
      return ((await res.json()) as { user: CmsUser }).user;
    },
  };
}
