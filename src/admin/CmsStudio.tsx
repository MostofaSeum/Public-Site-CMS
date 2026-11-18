import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { Globe, Eye } from 'lucide-react';
import type { CmsConfig } from '../core/types';
import { findPage } from '../core/defineCms';
import { StudioProvider } from './StudioContext';
import { CanvasEditor } from './CanvasEditor';
import { LivePreviewModal } from './LivePreviewModal';

export interface CmsStudioProps {
  config: CmsConfig;
  /** Page key opened first. Defaults to the first configured page. */
  initialPage?: string;
  /** Called when the editor switches page (e.g. to sync a ?page= query string). */
  onPageChange?: (page: string) => void;
  /** Render the toast container. Set to false if your app already renders react-hot-toast's <Toaster />. */
  toaster?: boolean;
}

function StudioContent({ config, initialPage, onPageChange }: CmsStudioProps) {
  const firstPage = config.pages[0]?.key ?? '';
  const [activePage, setActivePage] = useState<string>(
    initialPage && findPage(config, initialPage) ? initialPage : firstPage
  );
  const [isGlobalPreviewOpen, setIsGlobalPreviewOpen] = useState(false);

  // Follow external navigation (e.g. the host's sidebar links)
  useEffect(() => {
    if (initialPage && findPage(config, initialPage)) setActivePage(initialPage);
  }, [initialPage, config]);

  const changePage = (page: string) => {
    setActivePage(page);
    if (onPageChange) onPageChange(page);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 text-white mx-auto max-w-[1920px]">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {config.title || 'Site CMS'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Hover over any section in the live preview, or select one from the editor panel.
            </p>
          </div>
        </div>

        {/* Global toolbar */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsGlobalPreviewOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 transition-all"
          >
            <Eye className="w-4 h-4" />
            <span>Launch Live Preview</span>
          </button>
        </div>
      </div>

      <CanvasEditor initialPage={activePage} onPageChange={changePage} />

      {/* Global live preview modal */}
      <LivePreviewModal
        isOpen={isGlobalPreviewOpen}
        onClose={() => setIsGlobalPreviewOpen(false)}
        pagePath={findPage(config, activePage)?.route || '/'}
      />
    </div>
  );
}

/**
 * The complete CMS admin screen: page switcher, live preview canvas with
 * hover-to-edit, and the section form editor. Render it on a protected admin route.
 */
export const CmsStudio: React.FC<CmsStudioProps> = (props) => {
  const { config, toaster = true } = props;
  return (
    <StudioProvider config={config}>
      <div className="min-h-full bg-slate-950">
        <StudioContent {...props} />
      </div>
      {toaster && <Toaster position="top-right" />}
    </StudioProvider>
  );
};
