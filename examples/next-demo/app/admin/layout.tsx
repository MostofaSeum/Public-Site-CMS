'use client';

import Link from 'next/link';
import { CmsNavButton } from '@brainicon/storio-elements-editor/admin';

// Stand-in for the host app's existing admin panel. The only CMS-specific line
// is the <CmsNavButton>; protect this route with your own auth.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-950">
      <aside className="w-56 shrink-0 border-r border-slate-800 p-4 space-y-2">
        <div className="text-white font-bold px-4 pb-4">My Admin</div>
        <Link href="/" className="block px-4 py-2.5 text-sm text-slate-400 hover:text-white">
          View site
        </Link>
        <CmsNavButton href="/admin/cms" as={Link} active />
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
