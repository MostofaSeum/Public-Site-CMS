import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { Globe, Eye, Wand2, Sliders } from 'lucide-react';
import type { CmsConfig } from '../core/types';
import { findPage } from '../core/defineCms';
import { StudioProvider } from './StudioContext';
import { CanvasEditor } from './CanvasEditor';
import { FormStudio } from './FormStudio';
import { LivePreviewModal } from './LivePreviewModal';

export interface CmsStudioProps {
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

function StudioContent({ config, initialPage, onPageChange, defaultMode = 'canvas' }: CmsStudioProps) {
  const firstPage = config.pages[0]?.key ?? '';
  const [activePage, setActivePage] = useState<string>(
    initialPage && findPage(config, initialPage) ? initialPage : firstPage
  );
  const [isGlobalPreviewOpen, setIsGlobalPreviewOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'canvas' | 'form'>(defaultMode);

  // Follow external navigation (e.g. the host's sidebar links)
  useEffect(() => {
    if (initialPage && findPage(config, initialPage)) setActivePage(initialPage);
  }, [initialPage, config]);

  const changePage = (page: string) => {
    setActivePage(page);
    if (onPageChange) onPageChange(page);
  };

  return (
    <div className={`p-4 sm:p-6 lg:p-8 space-y-6 text-white mx-auto ${editorMode === 'canvas' ? 'max-w-[1920px]' : 'max-w-7xl'}`}>
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
              Live content editor for your public pages.
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

      {/* Two editor experiences: interactive canvas vs form studio */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 bg-slate-900/90 border border-purple-500/25 rounded-2xl shadow-xl">
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 border border-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => setEditorMode('canvas')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
              editorMode === 'canvas'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-900/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wand2 className="w-4 h-4 text-purple-300" />
            <span>Visual Interactive Canvas</span>
          </button>

          <button
            type="button"
            onClick={() => setEditorMode('form')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
              editorMode === 'form'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-900/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4 text-purple-300" />
            <span>Form Studio</span>
          </button>
        </div>

        <p className="text-xs text-slate-400 px-2 hidden md:block">
          {editorMode === 'canvas'
            ? 'Hover over any section in the live preview or select from the editor panel.'
            : 'Pick a section from the list and edit its fields.'}
        </p>
      </div>

      {editorMode === 'canvas' ? (
        <CanvasEditor initialPage={activePage} onPageChange={changePage} />
      ) : (
        <FormStudio activePage={activePage} onPageChange={changePage} />
      )}

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
