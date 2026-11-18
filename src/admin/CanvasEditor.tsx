import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Monitor,
  Tablet,
  Smartphone,
  RotateCcw,
  ExternalLink,
  Layers,
  Loader2,
  CheckCircle2,
  MousePointerClick,
  ChevronRight,
  Pencil,
  Eye,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { PageDef, SectionDetail } from '../core/types';
import { findPage } from '../core/defineCms';
import { getSectionDetail } from '../core/merge';
import { CMS_MESSAGE, listenForCmsMessages, postCmsMessage } from '../core/messages';
import { buildPreviewUrl, publicUrl } from '../core/paths';
import { SectionEditorForm } from './SectionEditorForm';
import { useStudio } from './StudioContext';

type DeviceMode = 'desktop' | 'tablet' | 'mobile';

// Responsive viewport scale configurations.
// Desktop renders at a full 1280px inside the preview iframe and is scaled down with a
// CSS transform, so desktop breakpoints (md:, lg:) stay active in a narrow panel.
const DEVICE_VIEWPORTS: Record<
  DeviceMode,
  { label: string; width: number; icon: React.ComponentType<{ className?: string }> }
> = {
  desktop: { label: 'Desktop', width: 1280, icon: Monitor },
  tablet: { label: 'Tablet', width: 768, icon: Tablet },
  mobile: { label: 'Mobile', width: 390, icon: Smartphone },
};

export interface CanvasEditorProps {
  initialPage?: string;
  onPageChange?: (page: string) => void;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({ initialPage, onPageChange }) => {
  const { config, origins } = useStudio();
  const adapter = config.adapter;
  const [activePage, setActivePage] = useState<string>(initialPage || config.pages[0]?.key || '');

  // Sync state if initialPage changes from outside
  useEffect(() => {
    if (initialPage) setActivePage(initialPage);
  }, [initialPage]);

  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [isEditModeActive, setIsEditModeActive] = useState<boolean>(true);
  // Starts at 0 so server and client render the same iframe src; bumped on refresh.
  const [iframeKey, setIframeKey] = useState<number>(0);
  const [isLoadingIframe, setIsLoadingIframe] = useState(true);

  // Active section currently open in the left editor
  const pageDef: PageDef | undefined = findPage(config, activePage);
  const availableSections = pageDef?.sections ?? [];
  const [activeSectionKey, setActiveSectionKey] = useState<string>(availableSections[0]?.key ?? '');
  // The single field opened with its own pencil. Null shows the whole section.
  const [activeFieldPath, setActiveFieldPath] = useState<string | null>(null);
  const hasUnsavedEdits = useRef(false);
  const activeSectionRef = useRef(activeSectionKey);
  activeSectionRef.current = activeSectionKey;
  const [sectionDetail, setSectionDetail] = useState<SectionDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const viewportContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: 1000,
    height: 800,
  });

  // Measure container dimensions to compute the transform scale
  useEffect(() => {
    if (!viewportContainerRef.current) return;
    const updateSize = () => {
      if (viewportContainerRef.current) {
        setContainerSize({
          width: viewportContainerRef.current.clientWidth,
          height: viewportContainerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewportContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // The iframe can finish loading before React attaches onLoad (it starts loading
  // from the server-rendered HTML), so also check its state directly.
  useEffect(() => {
    if (!isLoadingIframe) return;
    const check = () => {
      try {
        const doc = iframeRef.current?.contentDocument;
        // A fresh iframe briefly reports "complete" for about:blank; wait for the real page.
        if (doc && doc.readyState === 'complete' && doc.location.href !== 'about:blank') {
          setIsLoadingIframe(false);
        }
      } catch {
        // Cross-origin preview: rely on onLoad and the timeout below.
      }
    };
    check();
    const interval = setInterval(check, 300);
    const timeout = setTimeout(() => setIsLoadingIframe(false), 10000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isLoadingIframe, iframeKey]);

  const currentRoute = pageDef?.route || '/';
  const activePageTitle = pageDef?.title || activePage;
  const activePageIcon = pageDef?.icon || Layers;

  const iframeSrc = buildPreviewUrl(currentRoute, {
    publicSiteUrl: config.publicSiteUrl,
    editMode: isEditModeActive,
    cacheBust: iframeKey,
  });

  const sendToPreview = useCallback(
    (message: Parameters<typeof postCmsMessage>[1]) => {
      postCmsMessage(iframeRef.current?.contentWindow, message, origins);
    },
    [origins]
  );

  /** Asks before unsaved edits are lost, and removes them from the preview when the editor agrees. */
  const confirmLeavingSection = useCallback(() => {
    if (!hasUnsavedEdits.current) return true;
    if (!window.confirm('You have unsaved changes in this section. Leave without saving them?')) return false;
    hasUnsavedEdits.current = false;
    sendToPreview({ type: CMS_MESSAGE.CONTENT_UPDATED });
    return true;
  }, [sendToPreview]);

  const changePage = (pageKey: string) => {
    if (!confirmLeavingSection()) return;
    setActiveFieldPath(null);
    setActivePage(pageKey);
    setIsLoadingIframe(true);
    setIframeKey(Date.now());
    if (onPageChange) onPageChange(pageKey);
  };

  const toggleEditMode = () => {
    const next = !isEditModeActive;
    setIsEditModeActive(next);
    sendToPreview({ type: CMS_MESSAGE.SET_EDIT_MODE, enabled: next });
    toast.success(
      next
        ? 'Edit Mode Active: Hover & click sections to edit'
        : 'Normal Browsing Mode: Edit options hidden',
      { duration: 2500 }
    );
  };

  // Default to the first section when the active page changes.
  useEffect(() => {
    if (
      availableSections.length > 0 &&
      !availableSections.some((section) => section.key === activeSectionKey)
    ) {
      setActiveSectionKey(availableSections[0].key);
    }
  }, [activePage, activeSectionKey, availableSections]);

  // Load section detail
  const loadSectionData = useCallback(
    async (page: PageDef, sectionKey: string) => {
      setIsLoadingDetail(true);
      try {
        const record = await adapter.getRecord(page.key, sectionKey, { includeDrafts: true });
        setSectionDetail(getSectionDetail(page, sectionKey, record));
      } catch {
        toast.error(`Failed to load data for section '${sectionKey}'`);
      } finally {
        setIsLoadingDetail(false);
      }
    },
    [adapter]
  );

  useEffect(() => {
    if (!pageDef) return;
    const isSectionValid = availableSections.some((section) => section.key === activeSectionKey);
    if (activeSectionKey && isSectionValid) {
      loadSectionData(pageDef, activeSectionKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage, activeSectionKey, loadSectionData]);

  // Two-way interaction: select a section on the left -> scroll the preview to it
  const handleSelectSection = (sectionKey: string) => {
    if (sectionKey !== activeSectionKey && !confirmLeavingSection()) return;
    setActiveFieldPath(null);
    setActiveSectionKey(sectionKey);
    sendToPreview({ type: CMS_MESSAGE.SCROLL_TO_SECTION, sectionKey });
  };

  // Listen for CMS_EDIT_SECTION when a section's edit button is clicked in the preview
  useEffect(() => {
    if (origins.length === 0) return;
    return listenForCmsMessages(
      (message) => {
        if (message.type !== CMS_MESSAGE.EDIT_SECTION || !message.sectionKey) return;
        if (!availableSections.some((s) => s.key === message.sectionKey)) {
          toast.error(`Section '${message.sectionKey}' is not configured for this page`);
          return;
        }
        if (message.sectionKey !== activeSectionRef.current && !confirmLeavingSection()) return;
        setActiveFieldPath(message.fieldPath ?? null);
        setActiveSectionKey(message.sectionKey);
        toast.success(`Selected: ${message.title || message.sectionKey} in Editor`, {
          duration: 2000,
        });
      },
      { origins, source: () => iframeRef.current?.contentWindow }
    );
  }, [origins, availableSections, confirmLeavingSection]);

  // Save handler for the left editor panel.
  // Errors are re-thrown so SectionEditorForm shows a single toast.
  const handleSaveSection = async (content: unknown, isPublished: boolean) => {
    if (!pageDef) return;
    await adapter.saveRecord({ page: activePage, sectionKey: activeSectionKey, content, isPublished });

    // Update the preview immediately, then have it refetch from storage
    sendToPreview({
      type: CMS_MESSAGE.DRAFT_PREVIEW,
      page: activePage,
      sectionKey: activeSectionKey,
      draftContent: content,
    });
    sendToPreview({ type: CMS_MESSAGE.CONTENT_UPDATED });

    const record = await adapter.getRecord(activePage, activeSectionKey, { includeDrafts: true });
    setSectionDetail(getSectionDetail(pageDef, activeSectionKey, record));
  };

  // Reset handler for the left editor panel.
  const handleResetSection = async () => {
    if (!pageDef) return;
    await adapter.deleteRecord(activePage, activeSectionKey);
    sendToPreview({ type: CMS_MESSAGE.CONTENT_UPDATED });
    setSectionDetail(getSectionDetail(pageDef, activeSectionKey, null));
  };

  // Real-time draft preview: sends live form edits into the preview without saving
  const handleDraftChange = (draftContent: unknown) => {
    sendToPreview({
      type: CMS_MESSAGE.DRAFT_PREVIEW,
      page: activePage,
      sectionKey: activeSectionKey,
      draftContent,
    });
  };

  const handleRefreshPreview = () => {
    setIsLoadingIframe(true);
    setIframeKey(Date.now());
  };

  const activeSectionDef = availableSections.find((s) => s.key === activeSectionKey);
  const currentSectionLabel = activeSectionDef?.label || activeSectionKey.replace(/([A-Z])/g, ' $1');

  if (!pageDef) {
    return (
      <div className="p-8 text-center text-sm text-slate-400 bg-slate-900/60 rounded-2xl border border-purple-500/20">
        No pages configured. Add pages to the <code className="text-purple-300">pages</code> array of your CMS config.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top control header: page, device and canvas controls */}
      <div className="p-3 rounded-2xl bg-slate-900/90 border border-purple-500/20 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shadow-xl">
        {/* Left: page info and page selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-600/25 border border-purple-500/40 text-purple-200 shrink-0">
            {React.createElement(activePageIcon, { className: 'w-3.5 h-3.5 text-purple-300' })}
            <span className="font-bold text-white max-w-[150px] truncate">{activePageTitle}</span>
            <span className="text-[10px] font-mono opacity-70 text-purple-300">({currentRoute})</span>
          </div>

          {config.pages.length > 1 && (
            <select
              value={activePage}
              onChange={(e) => {
                if (e.target.value) changePage(e.target.value);
              }}
              aria-label="Page to edit"
              className="text-xs px-2.5 py-1.5 rounded-xl bg-slate-950 border border-purple-500/30 text-purple-200 focus:outline-none focus:border-purple-400 max-w-[200px] sm:max-w-[260px] md:max-w-[320px] truncate"
            >
              {config.pages.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.title} ({p.route})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Right: viewport controls + edit mode + preview actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Device viewport switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-950/70 border border-slate-800 rounded-xl shrink-0">
            {(Object.keys(DEVICE_VIEWPORTS) as DeviceMode[]).map((mode) => {
              const conf = DEVICE_VIEWPORTS[mode];
              const Icon = conf.icon;
              const isCurrent = device === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDevice(mode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isCurrent
                      ? 'bg-purple-900/80 text-purple-200 border border-purple-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title={`${conf.label} (${conf.width}px)`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{conf.label}</span>
                </button>
              );
            })}
          </div>

          {/* Edit mode toggle + reload + open live */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={toggleEditMode}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border shrink-0 ${
                isEditModeActive
                  ? 'bg-purple-600 text-white border-purple-400 shadow-sm shadow-purple-900/30'
                  : 'bg-slate-950/70 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800/60'
              }`}
              title={
                isEditModeActive
                  ? 'Edit Mode is ON. Click to turn OFF and interact with webpage normally.'
                  : 'Edit Mode is OFF. Click to turn ON and enable section edit buttons.'
              }
            >
              {isEditModeActive ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse shrink-0" />
                  <Pencil className="w-3 h-3 text-purple-200 shrink-0" />
                  <span>Edit Mode</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
                  <Eye className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>View Mode</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleRefreshPreview}
              className="p-1.5 rounded-lg bg-slate-950/70 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
              title="Reload live canvas"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <a
              href={publicUrl(currentRoute, config.publicSiteUrl)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950/70 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-medium transition-colors"
              title="Open in new window"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Open Live</span>
            </a>
          </div>
        </div>
      </div>

      {/* Split screen: left editor + right preview canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT PANEL: section navigator + live form editor */}
        <div className="lg:col-span-5 xl:col-span-5 flex flex-col space-y-3 lg:sticky lg:top-2 lg:max-h-[calc(100vh-80px)] overflow-y-auto pr-1 custom-scrollbar">
          {/* Section selection bar */}
          <div className="p-3 rounded-xl bg-slate-900/95 border border-purple-500/25 backdrop-blur-sm space-y-2.5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Select Section to Edit:</span>
              </span>
              <span className="text-[10px] font-mono text-purple-300 px-2 py-0.5 rounded-full bg-purple-950/60 border border-purple-800/40">
                Page: {currentRoute}
              </span>
            </div>

            {/* Section switcher pills */}
            <div className="flex flex-wrap gap-1.5">
              {availableSections.map((sec) => {
                const isSelected = sec.key === activeSectionKey;
                const IconComponent = sec.icon;
                return (
                  <button
                    key={sec.key}
                    type="button"
                    onClick={() => handleSelectSection(sec.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-900/50 ring-1 ring-purple-400'
                        : 'bg-slate-950/70 hover:bg-slate-800/80 text-slate-300 border border-slate-800'
                    }`}
                  >
                    {IconComponent && <IconComponent className="w-3.5 h-3.5 opacity-80" />}
                    <span>{sec.label}</span>
                    {isSelected && <ChevronRight className="w-3 h-3 text-purple-200" />}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
              <MousePointerClick className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>Selecting a section scrolls the preview on the right to it.</span>
            </div>
          </div>

          {/* Form area for the active section */}
          <div className="rounded-2xl bg-slate-900/80 border border-purple-500/20 p-3 sm:p-4 shadow-xl">
            {isLoadingDetail ? (
              <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                <span>Loading section form...</span>
              </div>
            ) : sectionDetail && sectionDetail.sectionKey === activeSectionKey && sectionDetail.page === activePage ? (
              <SectionEditorForm
                page={activePage}
                sectionKey={activeSectionKey}
                sectionLabel={activeSectionDef?.label}
                pagePath={currentRoute}
                transform={activeSectionDef?.transform}
                focusPath={activeFieldPath}
                onClearFocus={() => setActiveFieldPath(null)}
                onDirtyChange={(dirty) => {
                  hasUnsavedEdits.current = dirty;
                }}
                initialData={sectionDetail.content}
                hasCustomOverride={sectionDetail.hasCustomOverride}
                isPublished={sectionDetail.isPublished}
                updatedAt={sectionDetail.updatedAt}
                updatedBy={sectionDetail.updatedBy}
                onSave={handleSaveSection}
                onReset={handleResetSection}
                onChangeDraft={handleDraftChange}
              />
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                Select a section to begin editing.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: live interactive preview canvas */}
        <div className="lg:col-span-7 xl:col-span-7 flex flex-col space-y-3">
          {/* Canvas status banner */}
          <div className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-purple-950/40 border border-purple-500/25 flex items-center justify-between gap-2 text-xs text-purple-200 shadow-md">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isEditModeActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              />
              <span className="truncate">
                {isEditModeActive ? (
                  <>
                    Live Interactive Canvas: <strong className="text-white">{currentSectionLabel}</strong> is active in editor.
                  </>
                ) : (
                  <>
                    Normal Webpage Mode: Interacting normally without edit buttons. Toggle <strong>Edit Mode ON</strong> to edit.
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-300 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isEditModeActive ? 'Edit Mode ON' : 'Normal View'}</span>
            </div>
          </div>

          {/* Canvas viewport frame */}
          <div
            ref={viewportContainerRef}
            className="relative min-h-[750px] h-[calc(100vh-160px)] bg-slate-950 rounded-2xl border border-purple-500/20 shadow-2xl p-2 sm:p-4 flex flex-col items-center justify-start overflow-hidden"
          >
            {/* Dot grid */}
            <div
              className="absolute inset-0 pointer-events-none opacity-20"
              style={{
                backgroundImage: 'radial-gradient(circle, #a855f7 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />

            {/* Loading indicator */}
            {isLoadingIframe && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm gap-2">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                <span className="text-xs text-slate-400">Loading interactive preview...</span>
              </div>
            )}

            {/* Responsive viewport wrapper */}
            {(() => {
              const targetWidth = DEVICE_VIEWPORTS[device].width;
              const availW = Math.max(containerSize.width - 24, 320);
              const availH = Math.max(containerSize.height - 24, 400);

              // Scale so the target width fits inside the available container width
              const scale = availW < targetWidth ? availW / targetWidth : 1;
              const unscaledHeight = availH / scale;

              return (
                <div
                  className="w-full h-full flex items-start justify-center overflow-hidden"
                  style={{ width: `${availW}px`, height: `${availH}px` }}
                >
                  <div
                    style={{
                      width: `${targetWidth}px`,
                      height: `${unscaledHeight}px`,
                      transform: `scale(${scale})`,
                      transformOrigin: 'top center',
                    }}
                    className={`shrink-0 transition-all duration-200 overflow-hidden shadow-2xl border ${
                      device === 'mobile'
                        ? 'border-slate-700 bg-slate-900 rounded-[38px] p-2 ring-8 ring-slate-800'
                        : device === 'tablet'
                        ? 'border-slate-700 bg-slate-900 rounded-[28px] p-2 ring-4 ring-slate-800'
                        : 'border-slate-800 bg-white rounded-xl'
                    }`}
                  >
                    {/* Mobile notch simulation */}
                    {device === 'mobile' && (
                      <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-1 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-slate-900" />
                      </div>
                    )}

                    <iframe
                      ref={iframeRef}
                      src={iframeSrc}
                      title="Public Site Live Preview"
                      className="w-full h-full bg-white block"
                      style={{ border: 'none' }}
                      onLoad={() => setIsLoadingIframe(false)}
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};
