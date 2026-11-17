import React from 'react';
import { C as CmsConfig } from './types-Df7jmywN.mjs';

interface CmsStudioProps {
    config: CmsConfig;
    /** Page key opened first. Defaults to the first configured page. */
    initialPage?: string;
    /** Called when the editor switches page (e.g. to sync a ?page= query string). */
    onPageChange?: (page: string) => void;
    /** Editor opened first. Defaults to the visual canvas. */
    defaultMode?: 'canvas' | 'form';
    /** Render the toast container. Set to false if your app already renders react-hot-toast's <Toaster />. */
    toaster?: boolean;
}
/**
 * The complete CMS admin screen: page switcher, live preview canvas with
 * hover-to-edit, and the section form editor. Render it on a protected admin route.
 */
declare const CmsStudio: React.FC<CmsStudioProps>;

interface CmsNavButtonProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
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
declare const CmsNavButton: React.FC<CmsNavButtonProps>;

/**
 * Universal dynamic Lucide icon resolver
 * Safely resolves any icon name string to a Lucide React component with fallback.
 */
declare function getDynamicIcon(iconName?: string, fallback?: React.ComponentType<{
    className?: string;
}>): React.ComponentType<{
    className?: string;
}>;
/**
 * Popular icons catalog for the visual icon picker
 */
declare const POPULAR_ICONS: {
    name: string;
    category: string;
}[];

export { CmsNavButton, type CmsNavButtonProps, CmsStudio, type CmsStudioProps, POPULAR_ICONS, getDynamicIcon };
