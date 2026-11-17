import Link from 'next/link';

export function SiteNav() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
      <Link href="/" className="font-bold">Demo Site</Link>
      <div className="flex gap-6 text-sm">
        <Link href="/">Home</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/admin/cms" className="text-purple-600 font-semibold">Admin</Link>
      </div>
    </nav>
  );
}
