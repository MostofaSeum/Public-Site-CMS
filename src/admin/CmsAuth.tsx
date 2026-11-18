import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Lock, LogOut } from 'lucide-react';
import type { CmsAuth, CmsUser } from '../adapters/auth';

/** Only same-site paths ("/admin"), never "//evil.com" or "https://evil.com". */
export function safeNext(value: string | null | undefined): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : null;
}

export interface CmsLoginProps {
  auth: CmsAuth;
  title?: string;
  /** Called after a successful sign-in. Default: go to ?next=... or `redirectTo`. */
  onSuccess?: (user: CmsUser) => void;
  /** Where to go after signing in when there is no ?next=. Default: "/". */
  redirectTo?: string;
}

/** Username + password form that signs the editor in with `cmsAuth`. */
export const CmsLogin: React.FC<CmsLoginProps> = ({ auth, title = 'Sign in to edit your site', onSuccess, redirectTo = '/' }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const user = await auth.login(username.trim(), password);
      if (onSuccess) onSuccess(user);
      else window.location.assign(safeNext(new URLSearchParams(window.location.search).get('next')) ?? redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
      setPassword('');
      setBusy(false);
    }
  };

  const field =
    'w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30';

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10 text-white">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-xl border border-purple-500/30 bg-purple-600/20 p-3 text-purple-400">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-xs text-slate-400">Use your staff username and password.</p>
        </div>

        <label className="block space-y-1.5 text-xs font-semibold text-slate-300">
          Username
          <input className={field} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
        </label>
        <label className="block space-y-1.5 text-xs font-semibold text-slate-300">
          Password
          <input className={field} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>

        {error && (
          <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-purple-500 disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
};

export interface CmsAuthGateProps {
  auth: CmsAuth;
  /**
   * Send signed-out visitors to this page (for example "/admin/login") and back afterwards.
   * Without it the sign-in form is shown in place. The gate never hides the login page itself.
   */
  loginPath?: string;
  title?: string;
  children: React.ReactNode;
}

type GateState = 'checking' | 'in' | 'out' | 'error' | 'login-page';

/**
 * Shows its children only to a signed-in editor. Wrap the CMS screen, or a whole admin
 * layout. This guards the screen, not your own API: protect those endpoints on the server.
 */
export const CmsAuthGate: React.FC<CmsAuthGateProps> = ({ auth, loginPath, title, children }) => {
  const [state, setState] = useState<GateState>('checking');
  const [message, setMessage] = useState('');

  const verify = useCallback(async () => {
    if (loginPath && window.location.pathname === loginPath) {
      setState('login-page');
      return;
    }
    setState('checking');
    try {
      const user = await auth.check();
      if (user) return setState('in');
      if (loginPath) {
        const back = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.replace(`${loginPath}?next=${back}`);
        return;
      }
      setState('out');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not check your sign-in.');
      setState('error');
    }
  }, [auth, loginPath]);

  useEffect(() => {
    void verify();
  }, [verify]);

  if (state === 'in' || state === 'login-page') return <>{children}</>;
  if (state === 'out') return <CmsLogin auth={auth} title={title} onSuccess={() => void verify()} />;
  if (state === 'error') {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center text-white">
        <p className="text-sm text-slate-300">{message}</p>
        <button type="button" onClick={() => void verify()} className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold hover:bg-purple-500">
          Try again
        </button>
      </div>
    );
  }
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-slate-400" role="status" aria-label="Checking your sign-in">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
};

export interface CmsLogoutButtonProps {
  auth: CmsAuth;
  /** Where to go after signing out. Default: "/". */
  redirectTo?: string;
  className?: string;
  children?: React.ReactNode;
}

/** Signs the editor out (forgets the token) and leaves the admin. */
export const CmsLogoutButton: React.FC<CmsLogoutButtonProps> = ({ auth, redirectTo = '/', className, children }) => (
  <button
    type="button"
    className={className ?? 'inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700'}
    onClick={() => {
      auth.logout();
      window.location.assign(redirectTo);
    }}
  >
    {children ?? (
      <>
        <LogOut className="h-3.5 w-3.5" /> Sign out
      </>
    )}
  </button>
);
