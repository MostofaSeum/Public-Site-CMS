import React from 'react';
import { Globe } from 'lucide-react';

export interface CmsNavButtonProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Route where <CmsStudio /> is rendered, e.g. "/admin/cms". */
  href: string;
  /** Highlight the button (e.g. when the current path is the studio). */
  active?: boolean;
  label?: string;
  /**
   * Link component to render with, e.g. Next.js `Link` or React Router's `Link`,
   * so navigation stays client-side. Defaults to a plain <a>.
   */
  as?: React.ElementType;
}

/** Ready-made "CMS" menu entry for an admin sidebar or navbar. */
export const CmsNavButton: React.FC<CmsNavButtonProps> = ({
  href,
  active = false,
  label = 'CMS',
  as: Component = 'a',
  className,
  ...rest
}) => (
  <Component
    href={href}
    aria-current={active ? 'page' : undefined}
    className={
      className ??
      `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
        active
          ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
          : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
      }`
    }
    {...rest}
  >
    <Globe className="w-5 h-5" />
    <span>{label}</span>
  </Component>
);
